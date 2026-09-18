require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("./src/middlewares/rateLimiter");
const indexRoutes = require("./src/routes/indexRoutes");
const notFound = require("./src/middlewares/notFound");
const globalErrorHandler = require("./src/middlewares/errorHandler");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swagger");
const path = require("path");
const ENVIRONMENT = require("./src/config/env");
const webhookRoutes = require("./src/routes/webhookRoutes");
//cron file
// require("./src/workers/ticketGenerator");
// require("./src/workers/cancelOrderCron");
console.log(ENVIRONMENT.NODE_ENV, "NODEENV")

const app = express();
app.use('/webhook', webhookRoutes)
app.use(helmet());
const allowedOrigins = [
    "https://taal.life",
    "https://www.taal.life",
    "https://admin.taal.life",
    "http://localhost:3000",
    "http://localhost:3001",
];

const isDevelopment = ENVIRONMENT.NODE_ENV !== "production";
const localhostRegex = /^http:\/\/localhost:\d+$/;

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (isDevelopment && localhostRegex.test(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));




app.use((req, res, next) => {
    req.query = { ...req.query };
    next();
});

// app.use(rateLimit);

// ------------------------
// ✅ Routes
// ------------------------
app.use("/api/v1", indexRoutes);

//dummy route
app.get("/api/v1/test", (req, res) => {
    res.send("Hello world!");
});

app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;

