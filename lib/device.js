'use strict';

const th = require('tinkerhub');
const Q = require('q');

class ZigbeeDevice {
    constructor(zigbee, def, endpoints) {
        this._zigbee = zigbee;
        this._ieeeAddr = def.ieeeAddr;
        this._endpoints = endpoints;

        this.metadata = {
            type: [ 'zigbee' ],
            capabilities: [ 'nameable' ]
        };
    }

    _register() {
        this._device = th.devices.register('zigbee:' + this._ieeeAddr, this);
    }

    _remove() {
        this._device.remove();
    }

    _valueChange(ep, cid, key, value) {
        this._device.emit('zigbee:value', {
            endpoint: ep,
            cluster: cid,
            attribute: key,
            newValue: value
        });
    }

    zigbeeInspect() {
        const device = this._zigbee.list(this._ieeeAddr)[0];
        if(! device) {
            return {
                ieeeAddr: this._ieeeAddr,
                status: 'offline'
            };
        }

        const result = {
            ieeeAddr: device.ieeeAddr,
            status: device.status,
            type: device.type,

            networkAddr: device.nwkAddr,
            manufacturer: device.manufId,

            endpoints: []
        };

        Object.keys(this._endpoints).forEach(key => {
            const ep = this._endpoints[key].dump();
			const clusters = {};

			Object.keys(ep.clusters).forEach(cId => {
				const c = ep.clusters[cId];
				clusters[cId] = {
					in: c.dir.value == 1 || c.dir.value == 3,
					out: c.dir.value == 2,
					attributes: c.attrs
				}
			});

            result.endpoints.push({
				id: ep.epId,
				profileId: ep.profId,
				deviceId: ep.devId,
				clusters: clusters
			});
        });

        return result;
    }

    zigbeeFoundation(endpoint, clusterId, command, data) {
        const ep = this._endpoints[endpoint];
        if(! ep) throw new Error('Unknown endpoint: ' + endpoint);

        const deferred = Q.defer();
        ep.foundation(clusterId, command, data, function(err, rsp) {
            if(err) {
                deferred.reject(new Error(err));
            } else {
                deferred.resolve(rsp);
            }
        });
        return deferred.promise;
    }

	zigbeeRead(endpoint, clusterId, attribute) {
		const ep = this._endpoints[endpoint];
        if(! ep) throw new Error('Unknown endpoint: ' + endpoint);

        const deferred = Q.defer();
        ep.read(clusterId, attribute, function(err, rsp) {
            if(err) {
                deferred.reject(new Error(err));
            } else {
                deferred.resolve(rsp);
            }
        });
        return deferred.promise;
	}

    zigbeeFunctional(endpoint, clusterId, command, data) {
        const ep = this._endpoints[parseInt(endpoint)];
        if(! ep) throw new Error('Unknown endpoint: ' + endpoint);

        const deferred = Q.defer();
        ep.functional(clusterId, command, data || {}, function(err, rsp) {
            if(err) {
                deferred.reject(new Error(err));
            } else {
                deferred.resolve(rsp);
            }
        });
        return deferred.promise;
    }

    zigbeeReport(endpoint, clusterId) {
        const ep = this._endpoints[parseInt(endpoint)];
        if(! ep) throw new Error('Unknown endpoint: ' + endpoint);

		const deferred = Q.defer();
        ep.report(clusterId, function(err, data) {
			if(err) {
                deferred.reject(new Error(err));
            } else {
                deferred.resolve(data);
            }
        });
		return deferred.promise;
    }
}

module.exports = ZigbeeDevice;
