// EXPRESS:
const express = require("express");
const app = express();
const errorHandler = require("errorhandler");
const helmet = require("helmet");
const Router = require("express-promise-router");

var cors = require("cors");

const registerRoutes = require("./routers");
const router = Router();

// Descomentar para usar mongoDB
require('./storage/database/mongo');

// CORS:
const corsOptions = {
  origin: "*",
  optionsSuccessStatus: 200,
  methods: ['GET','POST','DELETE','UPDATE','PUT','PATCH'],
};
//app.use(cors());
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//helmet
app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.hidePoweredBy());
app.use(helmet.frameguard({ action: "deny" }));

router.use(errorHandler());

app.use(router);
//REGISTRO DE RUTAS
registerRoutes(router);

router.use((err, req, res, next) => {
  console.log(err);
  res.status(500).send(err.message);
});

app.listen(parseInt(process.env.PORT) || 8080, function (req, res) {
  console.log(`API Funcionando`);
});
