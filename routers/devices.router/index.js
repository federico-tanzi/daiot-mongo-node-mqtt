const devicesCollection = require("./models/devices");
const logsCollection = require("./models/logs");
const clientMqtt = require("../../broker/mqtt");
const options = clientMqtt.MQTTOptions;
let topics = ["/topic/qos0"];

clientMqtt.on("connect", async function () {

    const allTopics = await devicesCollection.distinct("topic");
    topics.push(...allTopics);

    clientMqtt.subscribe(topics, options, () => {
        console.log("Subscribed to topics: ");
        console.log(topics);
    });

    for (const element in topics) {
        const message = {
            deviceId: parseInt(element),
            name: "ESP32_TEMP_NODEjs",
            location: "Terraza",
            ts: new Date().getTime(),
            temperature: Math.floor(1 + Math.random()*(35)),
            humidity: Math.floor(60 + Math.random()*(41))
        };
        const payload = JSON.stringify(message);
        // Publico mensajes al inicio del servicio para verificar la subscripción
        clientMqtt.publish(topics[element], payload, options, (error) => {
            if (error) {
                console.log(error);
            }
        })
    }
    clientMqtt.on("message", async (topic, payload) => {
        console.log("[MQTT] Mensaje recibido: " + topic + ": " + payload.toString());
        let message = payload.toString();
        let jason;
        try {
            jason = JSON.parse(message);
        } catch (error) {
            console.log("FORMATO INCORRECTO, DEBE ENVIAR MENSAJES EN FORMATO JSON");
            return; // Salir de la función en caso de error de formato
        }
        // Verificar la existencia de todos los campos
        const camposEsperados = ['temperature', 'humidity', 'name', 'location'];
        const camposFaltantes = camposEsperados.filter((campo) => !(campo in jason));
        if (camposFaltantes.length > 0) {
            console.log('CAMPOS FALTANTES: ', camposFaltantes.join(', '));
            return;
        }
        // Validar el formato del JSON
        if (typeof jason.temperature !== 'number' || typeof jason.humidity !== 'number' || typeof jason.name !== 'string' || typeof jason.location !== 'string') {
            console.log('FORMATO INCORRECTO');
            return;
        }

        const findDevice = await devicesCollection.findOne({
            deviceId: jason.deviceId,
        });

        if (findDevice) {
            const elLog = new logsCollection({
                ts: new Date().getTime(),
                temperature: jason.temperature,
                humidity: jason.humidity,
                deviceId: jason.deviceId
            });
            try {
                await elLog.save();
                console.log("REGISTRO DE LOG AGREGADO CORRECTAMENTE.");
            } catch (error) {
                console.log("ERROR UPDATING");
            }
            await devicesCollection.findOneAndUpdate(
                { deviceId: jason.deviceId },
                {
                    temperature: jason.temperature,
                    humidity: jason.humidity
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
                deviceId: jason.deviceId,
                name: jason.name,
                location: jason.location,
                active: true,
                temperature: jason.temperature,
                humidity: jason.humidity,
                topic: topic
            });
            try {
                await newDevice.save();
                const elLog = new logsCollection({
                    ts: new Date().getTime(),
                    temperature: jason.temperature,
                    humidity: jason.humidity,
                    deviceId: jason.deviceId
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
    })

})

const register = (router) => {
    router.get('/devices', async function (req, res) {
        const devices = await devicesCollection.find();
        if (!devices) return res.json({ data: null, error: 'No hay datos en la Base de Datos.' });
        if (devices) return res.json({ data: devices, error: null });
    });

    router.get('/devices/:id', async function (req, res) {
        const device = await devicesCollection.findOne({ "deviceId": req.params.id });
        if (!device) return res.json({ data: null, error: 'No hay datos en la Base de Datos.' });
        if (device) return res.json({ data: device, error: null });
    });

    router.post('/devices', async function (req, res) {
        const deviceJson = req.body
        const newDevice = new devicesCollection(deviceJson);
        try {
            const savedDevice = await newDevice.save();
            return res.json({ data: savedDevice, error: null });
        } catch (error) {
            console.log("ERROR POST NEW DEVICE");
            return res.json({ data: null, error: error });
        }
    });

    router.put('/devices/:id', async function (req, res) {
        const deviceJson = req.body
        await devicesCollection.findOneAndUpdate(
            { deviceId: req.params.id },
            {
                name: deviceJson.name,
                location: deviceJson.location,
                topic: deviceJson.topic
            }).then(savedDevice => {
                 return res.json({ data: savedDevice, error: null });
            }).catch(error => {
                console.log("ERROR UPDATING DEVICE");
                return res.json({ data: null, error: error });
            });
    });

    router.put('/devices/active/:id', async function (req, res) {
        await devicesCollection.findOneAndUpdate(
            { _id: req.params.id },
            {
                active: true
            }).then(savedDevice => {
                 return res.json({ data: savedDevice, error: null });
            }).catch(error => {
                console.log("ERROR UPDATING DEVICE");
                return res.json({ data: null, error: error });
            });
    });

    router.put('/devices/inactive/:id', async function (req, res) {
        await devicesCollection.findOneAndUpdate(
            { _id: req.params.id },
            {
                active: false
            }).then(savedDevice => {
                 return res.json({ data: savedDevice, error: null });
            }).catch(error => {
                console.log("ERROR UPDATING DEVICE");
                return res.json({ data: null, error: error });
            });
    });

    router.get('/logs/:deviceId', async function (req, res) {
        const device_logs = await logsCollection.find(
            { "deviceId": req.params.deviceId }
        );
        if (!device_logs) return res.json({ data: [], error: 'No hay datos en la Base de Datos.' });
        if (device_logs) { return res.json({ data: device_logs, error: null }); }
    })

    router.get('/logs/:deviceId/:from/:to', async function (req, res) {
        const device_logs = await logsCollection.find(
            {deviceId: req.params.deviceId, ts:{$gte: req.params.from, $lte: req.params.to}
        });
        if (!device_logs) return res.json({ data: [], error: 'No hay datos en la Base de Datos.' });
        if (device_logs) { return res.json({ data: device_logs, error: null }); }
    })

    return router;
};

module.exports = {
    register
};
