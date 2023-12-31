require("dotenv").config();
module.exports = {
    services: {
        MQTT: {
            USERNAME: process.env.MQTT_USERNAME || "",
            PASSWORD: process.env.MQTT_PASSWORD || "",
            HOST: process.env.MQTT_HOST,
            PORT: process.env.MQTT_PORT
        },
        DATABASE: {
            MONGO: {
                USERNAME: process.env.DB_MONGO_USERNAME || "",
                PASSWORD: process.env.DB_MONGO_PASSWORD || "",
                DBNAME: process.env.DB_MONGO_NAME || "",
                HOST: process.env.DB_MONGO_HOST || "",
                PORT: process.env.DB_MONGO_PORT || ""
            }
        }
    },
    ROUTER_PATH: process.env.ROUTER_PATH || "",
    ENVIRONMENT: process.env.ENVIRONMENT || ""
}