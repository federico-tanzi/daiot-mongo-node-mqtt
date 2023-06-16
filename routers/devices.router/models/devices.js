const mongoose = require('mongoose');

const deviceSchema = mongoose.Schema({
    deviceId: {
        type: String,
        unique : true,
        require: true
    },
    name: {
        type: String,
    },
    location: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    },
    temperature: {
        type: Number,
    },
    humidity: {
        type: Number,
    },
    topic: {
        type: String,
        require: true
    }
});

module.exports = mongoose.model('Device', deviceSchema);
