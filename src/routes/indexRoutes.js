const express = require("express");
const router = express.Router();

router.use("/user", require("./userRoutes"));
router.use("/superadmin", require("./superadminRoutes"));
router.use("/common-management", require("./commonRoutes"));
router.use('/gatekeeper', require("./gatekeeperRoutes"));

module.exports = router;
