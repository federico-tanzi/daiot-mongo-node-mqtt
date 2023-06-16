const mongoose = require('mongoose');

const logsSchema = mongoose.Schema({
    ts: {
        type: Number,
        require: true,
        default: new Date().getTime()
    },
    temperature: {
        type: Number,
    },
    humidity: {
        type: Number,
    },
    deviceId: {
        type: String,
        require: true
    }
});

module.exports = mongoose.model('Logs', logsSchema);
