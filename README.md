# Zigbee Device Bridge for Tinkerhub

This module provides support for bridging devices found in a Zigbee network and
to bring them into a Tinkerhub as devices. It provides generic access to all
devices allowing them to be enhanced with specific functionality by running
other modules anywhere in the network.

Running only this module is usually not what you want, combine with specific
device implementations such as
[tinkerhub-device-zigbee-light](https://github.com/tinkerhub/tinkerhub-device-zigbee-light)
to expose the devices in a more user friendly way.

This module uses [zigbee-shepherd](https://github.com/zigbeer/zigbee-shepherd)
for connecting and managing the Zigbee network. Any hardware supported by
zigbee-shepherd will work with `tinkerhub-bridge-zigbee`. These currently are:

* SmartRF05EB (with CC2530EM)
* CC2531 USB Stick
* CC2538
* CC2630/CC2650

CC2530/31 needs specific firmware, see the [Hardware Wiki-page](https://github.com/zigbeer/zigbee-shepherd/wiki/1.-Hardware)
for how to install this on your hardware.

## Installation and setup

To install in your local project:

`npm install --save tinkerhub-bridge-zigbee`

If you are not using `th.autoload()` include module with `require('tinkerhub-bridge-zigbee')`.

When running your local project a new device of type `bridge-zigbee` will be
made available. To create a Zigbee network you need to tell this bridge which
USB-port to use. The easiest way to do this is via the CLI:

```
$ tinkerhub
> type:bridge-zigbee connect /dev/ttyACM0
 SUCCESS zigbee:bridge:ix77x0i92jyi
  configured: true
  connected: true
```

Make sure that Node has read and write permissions to your USB-device.

## Adding Zigbee devices

Call `permitJoin` on the brdige to allow Zigbee devices for 60 seconds.

```
$ tinkerhub
> type:bridge-zigbee permitJoin
 SUCCESS zigbee:bridge:ix77x0i92jyi
  null
```

After this put your device into the correct mode, usually by turning it on or
pushing a link button. If it pairs correctly a new device of type `zigbee` will
show up.

## Extending devices

As this module only exposes that basic Zigbee device you need to extend devices
with more useful functionality. You probably want to keep the Zigbee Cluster
Library documentation handy when working on your extended device.

```javascript
const th = require('tinkerhub');

th.devices.extend([ 'type:zigbee' ], function(encounter) {
	encounter.device.zigbeeInspect()
		.then(function(deviceData) {
			// Check for endpoints and clusters required here

			// If you have everything you need you can extend the device
			const extendedDevice = {
				metadata: {
					type: 'super-fancy-device'
				}
			};
			encounter.enhance(extendedDevice);
		});
})
```

## Device actions and events

### Action: `zigbeeInspect`

Return details about the Zigbee device. This will return information about
all endpoints and clusters available.

### Action: `zigbeeFoundation(endpoint, clusterId, command, data)`

Perform a foundation command on the specified endpoint. This can be used for
things such as reading multiple attributes.  See
[zcl-packet](https://github.com/zigbeer/zcl-packet) for names of commands.

```javascript
device.zigbeeFoundation(endpoint, 'genBasic', 'read', [
	{ attrId: 3 },
	{ attrId: 4 }
]).then(function(data) {

});
```

### Action: `zigbeeRead(endpoint, clusterId, attribute)`

Perform a read of a single attribute.

```javascript
device.zigbeeRead(endpoint, 'genBasic', 'manufacturerName')
	.then(function(name) {

	});
```

### Action: `zigbeeFunctional(endpoint, clusterId, command, data)`

Perform a functional command on the Zigbee device. This is used for things
such as turning a device on or off. See [zcl-packet](https://github.com/zigbeer/zcl-packet)
for names of commands.

```javascript
device.zigbeeFunctional(endpoint, 'genOnOff', 'toggle', {})
	.then(function() {

	});
```

### Event: `zigbee:value`

Event emitted when a value is reported to have changed. Data is an object
with the following keys:

* `endpoint`
* `cluster`
* `attribute`
* `newValue`
