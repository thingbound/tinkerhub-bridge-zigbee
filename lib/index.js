'use strict';

const th = require('tinkerhub');

const debug = th.debug('zigbee');

const path = require('path');

const ZShepherd = require('zigbee-shepherd');
const Device = require('./device');

const dataPath = path.join(th.storage.appdata, 'zigbee');
const fs = require('fs');
if(! fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath);
}

const config = th.storage.get('zigbee:controller') || {};
let currentPort = null;

// State used for tracking if we are configured and connected
const state = {
    configured: !! config.port,
    connected: false
};

// Information about the devices in the network
const devices = {};

let zigbee = null;
let connectPromise = null;

// Disconnect when the process exits
process.on('exit', function() {
    if(zigbee) {
        zigbee.stop();
    }
});

// SIGINT handler if called directly
if(! module.parent) {
    process.on('SIGINT', function() { process.exit() });
}

// Register a device for the initial controller
th.devices.register('zigbee:bridge:' + th.storage.machineId, {
    metadata: {
        type: [ 'bridge-zigbee' ],
        capabilities: [ 'config', 'state' ],
        name: 'Zigbee Bridge'
    },

    state: function() {
        return state;
    },

    connect: function(port) {
        const changedPort = config.port != port;

        config.port = port;
        th.storage.put('zigbee:controller', config);

        if(changedPort) {
            state.configured = !! port;
            return connect();
        } else {
            return state;
        }
    },

    _checkState() {
        if(! zigbee) throw new Error('Zigbee needs to be connected');
    },

    list(d) {
        this._checkState();
        return zigbee.list(d);
    },

    permitJoin() {
        zigbee.permitJoin(60, function(err) {
            if(err) {
                debug('Trouble allowing join', err);
            } else {
                debug('Devices can now join');
            }
        });
    }
});

function connect() {
    if(connectPromise) return connectPromise.promise;

    if(currentPort == config.port && state.connected) {
        // No port change and we are connected
        return state;
    }

    if(currentPort) {
        // Already connected, disconnect us
        zigbee.stop(function(err) {
            if(err) {
                debug('Unable to stop correctly ', err);
            }

            state.connected = false;
            currentPort = null;
            zigbee = null;

            // Try to connect to the new port
            connect();
        });

        return;
    }

    if(! config.port) {
        // If we have no port just return the state
        return state;
    }

    debug('Connecting to ' + config.port);

    currentPort = config.port;
    zigbee = new ZShepherd(config.port, {
        dbPath: path.join(dataPath, 'dev.db')
    });

    connectPromise = {};
    connectPromise.promise = new Promise(function(resolve, reject) {
        connectPromise.resolve = resolve;
        connectPromise.reject = reject;
    });

    zigbee.on('ready', function() {
        debug('Zigbee ready');
    })

    zigbee.start()
        .then(function() {
			state.connected = true;
            connectPromise.resolve(state);
            start();
        }, function(err) {
            connectPromise.reject(err);
        })
        .done();

    return connectPromise.promise;
}

function start() {
    debug('Zigbee connected, discovering');
    debug(zigbee.info());

    zigbee.on('error', function(err) {
        debug('Received an error', err);
    });

    zigbee.on('permitJoining', function(joinTimeLeft) {
        if(joinTimeLeft === 0) {
            debug('No longer allowing joining');
        }
    });

    zigbee.on('ind', function(msg) {
		debug('Got indication message', msg);
        if(msg.type === 'devIncoming') {
            zigbee.list(msg.data).forEach(registerDevice);
        } else if(msg.type === 'devChange') {
            msg.endpoints.forEach(ep => {
                const addr = ep.device.ieeeAddr;
                const device = devices[addr];
                if(device) {
                    Object.keys(msg.data.data).forEach(key => {
                        device._valueChange(ep.epId, msg.data.cid, key, msg.data.data[key]);
                    });
                }
            });
        }
    });

    const current = zigbee.list();
    current.forEach(registerDevice);
}

function registerDevice(device) {
    debug('Device', device.ieeeAdr);

    if(device.nwkAddr === 0) return;

    const eps = {};
    device.epList.forEach(epId => eps[epId] = zigbee.find(device.ieeeAddr, epId));

    const old = devices[device.ieeeAddr];
    if(old) {
        old._remove();
    }
    device = devices[device.ieeeAddr] = new Device(zigbee, device, eps);
    device._register();
}

// Always try to connect when we start
connect();
