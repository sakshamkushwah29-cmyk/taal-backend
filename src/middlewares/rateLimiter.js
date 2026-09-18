// src/middlewares/rateLimiter.js
const rateLimit = require("express-rate-limit");

const userRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
});

module.exports = userRateLimiter;
