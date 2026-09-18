// src/routes/webhookRoutes.js
const express = require("express");
const router = express.Router();
const { ticketBookingWebHook } = require("../controllers/webhookController");

// Razorpay webhook requires raw body
router.post("/ticket-razorpay-webhook", express.raw({ type: "application/json" }), ticketBookingWebHook);

module.exports = router;