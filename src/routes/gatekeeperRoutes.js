const express = require("express");
const router = express.Router();
const ticketCheckingController = require("../controllers/gatekeeperController/ticketCheckingController");
const { protect } = require("../utils/jwt");

router.post('/check-ticket', protect('gatekeeper'), ticketCheckingController.validateTicket);
router.get('/get-scanned-history', protect('gatekeeper'), ticketCheckingController.getScannedHistory);

module.exports = router;
