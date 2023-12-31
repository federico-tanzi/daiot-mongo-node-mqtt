const devicesCollection = require("./models/devices");
const logsCollection = require("./models/logs");
const clientMqtt = require("../../broker/mqtt");
const options = clientMqtt.MQTTOptions;
let topics = ["esp32/dht/data"];

const publishStatus = async (id, status) => {
    const device = await devicesCollection.findOne({_id: id});
    const message = {
        active: status.toString()
    };
    const payload = JSON.stringify(message);
    console.log("esp32/status/" + device["deviceId"], payload)
    clientMqtt.publish("esp32/status/" + device["deviceId"], payload, options, (error) => {
        if (error) {
            console.log(error);
        }
    })
}

clientMqtt.on("connect", async function () {

    const devices = await devicesCollection.find();

    for (const device of devices) {
        topics.push(device["topic"])
        const message = {
            active: device["active"].toString()
        };
        const payload = JSON.stringify(message);
        clientMqtt.publish("esp32/status/" + device["deviceId"], payload, options, (error) => {
            if (error) {
                console.log(error);
            }
        })
    }

    clientMqtt.subscribe(topics, options, () => {
        console.log("Subscribed to topics: ");
        console.log(topics);
    });

    clientMqtt.on("message", async (topic, payload) => {
        console.log("[MQTT] Mensaje recibido: " + topic + ": " + payload.toString());
        if (topic.startsWith('esp32/status/') && payload.toString() == 'ask_status') {
            const deviceId = topic.substring(13)
            const device = await devicesCollection.findOne({deviceId});
            const message = {
                active: device["active"].toString()
            };
            const payload = JSON.stringify(message);
            clientMqtt.publish(topic, payload, options, (error) => {
                if (error) {
                    console.log(error);
                }
            })
        }
        else {
            let message = payload.toString();
            let jason;
            try {
                jason = JSON.parse(message);
            } catch (error) {
                console.log("FORMATO INCORRECTO, DEBE ENVIAR MENSAJES EN FORMATO JSON");
                return; // Salir de la función en caso de error de formato
            }
            // Verificar la existencia de todos los campos
            const camposEsperados = ['temp', 'hum', 'device_id'];
            const camposFaltantes = camposEsperados.filter((campo) => !(campo in jason));
            if (camposFaltantes.length > 0) {
                console.log('CAMPOS FALTANTES: ', camposFaltantes.join(', '));
                return;
            }
            // Validar el formato del JSON
            if (typeof jason.temp !== 'string' || typeof jason.hum !== 'string' || typeof jason.device_id !== 'string') {
                console.log('FORMATO INCORRECTO');
                return;
            }

            const findDevice = await devicesCollection.findOne({
                deviceId: jason.device_id,
            });

            if (findDevice) {
                const elLog = new logsCollection({
                    ts: new Date().getTime(),
                    temperature: parseFloat(jason.temp),
                    humidity: parseFloat(jason.hum),
                    deviceId: jason.device_id
                });
                try {
                    await elLog.save();
                    console.log("REGISTRO DE LOG AGREGADO CORRECTAMENTE.");
                } catch (error) {
                    console.log("ERROR UPDATING");
                }
                await devicesCollection.findOneAndUpdate(
                    {deviceId: jason.device_id},
                    {
                        temperature: parseFloat(jason.temp),
                        humidity: parseFloat(jason.hum)
                    }).then(() => {
                    console.log("DISPOSITIVO ACTUALIZADO.");
                }).catch(err => {
                    console.log("ERROR UPDATING");
                });
            } else { // Si no existe creo un nuevo dispositivo
                console.log("Nodo no registrarlo, procedo a crearlo.");
                console.log("Topic recibido: " + topic);
                console.log("Datos del nodo: ");
                console.log(jason);
                // agrego un nuevo nodo en mongo
                const newDevice = new devicesCollection({
                    deviceId: jason.device_id,
                    name: 'DEFAULT',
                    location: 'DEFAULT',
                    active: true,
                    temperature: parseFloat(jason.temp),
                    humidity: parseFloat(jason.hum),
                    topic: topic
                });
                try {
                    await newDevice.save();
                    const elLog = new logsCollection({
                        ts: new Date().getTime(),
                        temperature: parseFloat(jason.temp),
                        humidity: parseFloat(jason.hum),
                        deviceId: jason.device_id
                    });
                    try {
                        await elLog.save();
                        console.log("REGISTRO DE LOG AGREGADO CORRECTAMENTE.");
                    } catch (error) {
                        console.log("ERROR UPDATING");
                    }
                    console.log("NUEVO NODO AGREGADO CORRECTAMENTE.");
                } catch (error) {
                    console.log("ERROR UPDATING");
                }
            }
        }
    })

})

const register = (router) => {
    router.get('/devices', async function (req, res) {
        const devices = await devicesCollection.find();
        if (!devices) return res.json({data: null, error: 'No hay datos en la Base de Datos.'});
        if (devices) return res.json({data: devices, error: null});
    });

    router.get('/devices/:id', async function (req, res) {
        const device = await devicesCollection.findOne({"deviceId": req.params.id});
        if (!device) return res.json({data: null, error: 'No hay datos en la Base de Datos.'});
        if (device) return res.json({data: device, error: null});
    });

    router.post('/devices', async function (req, res) {
        const deviceJson = req.body
        const newDevice = new devicesCollection(deviceJson);
        try {
            const savedDevice = await newDevice.save();
            clientMqtt.subscribe(savedDevice['topic'], options, () => {
                console.log("Subscribed to topics: ");
                console.log(savedDevice['topic']);
            });
            return res.json({data: savedDevice, error: null});
        } catch (error) {
            console.log("ERROR POST NEW DEVICE");
            return res.json({data: null, error: error});
        }
    });

    router.put('/devices/:id', async function (req, res) {
        const deviceJson = req.body
        await devicesCollection.findOneAndUpdate(
            {deviceId: req.params.id},
            {
                name: deviceJson.name,
                location: deviceJson.location,
                topic: deviceJson.topic
            }).then(savedDevice => {
            return res.json({data: savedDevice, error: null});
        }).catch(error => {
            console.log("ERROR UPDATING DEVICE");
            return res.json({data: null, error: error});
        });
    });

    router.put('/devices/active/:id', async function (req, res) {
        await devicesCollection.findOneAndUpdate(
            {_id: req.params.id},
            {
                active: true
            }).then(savedDevice => {
            console.log("Turned on", req.params.id);
            publishStatus(req.params.id, true).then(x => {
                return res.json({data: savedDevice, error: null});
            })
        }).catch(error => {
            console.log("ERROR UPDATING DEVICE");
            return res.json({data: null, error: error});
        });
    });

    router.put('/devices/inactive/:id', async function (req, res) {
        await devicesCollection.findOneAndUpdate(
            {_id: req.params.id},
            {
                active: false
            }).then(savedDevice => {
            console.log("Turned off", req.params.id);
            publishStatus(req.params.id, false).then(x => {
                return res.json({data: savedDevice, error: null});
            })
        }).catch(error => {
            console.log("ERROR UPDATING DEVICE");
            return res.json({data: null, error: error});
        });
    });

    router.get('/logs/:id', async function (req, res) {
        const device = await devicesCollection.findOne({_id: req.params.id});
        const device_logs = await logsCollection.find(
            {"deviceId": device['deviceId']}
        );
        if (!device_logs) return res.json({data: [], error: 'No hay datos en la Base de Datos.'});
        if (device_logs) {
            return res.json({data: device_logs, error: null});
        }
    })

    router.get('/logs/:id/:from/:to', async function (req, res) {
        const device = await devicesCollection.findOne({_id: req.params.id});
        const device_logs = await logsCollection.find(
            {
                deviceId: device['deviceId'], ts: {$gte: req.params.from, $lte: req.params.to}
            });
        if (!device_logs) return res.json({data: [], error: 'No hay datos en la Base de Datos.'});
        if (device_logs) {
            return res.json({data: device_logs, error: null});
        }
    })

    return router;
};

module.exports = {
    register
};
