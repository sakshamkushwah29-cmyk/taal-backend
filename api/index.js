const mongoose = require("mongoose");
const app = require("../app");
const ENVIRONMENT = require("../src/config/env");

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(ENVIRONMENT.MONGO_URI);
    }
    isConnected = true;
  }
  return app(req, res);
};
