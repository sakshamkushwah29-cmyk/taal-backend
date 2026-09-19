const mongoose = require("mongoose");
const app = require("../app");
const ENVIRONMENT = require("../src/config/env");

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected && ENVIRONMENT.MONGO_URI && mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(ENVIRONMENT.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
    } catch (err) {
      console.error("MongoDB connection error in serverless:", err.message);
    }
  }
  return app(req, res);
};
