const http = require("http");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const app = require("./app");
const { setupSocket } = require("./src/socket/socketHandler");
const ENVIRONMENT = require("./src/config/env");

dotenv.config();
const server = http.createServer(app);
setupSocket(server); // Attach socket to server

const PORT = ENVIRONMENT.PORT || 8080;
const DB = ENVIRONMENT.MONGO_URI;

mongoose
    .connect(DB)
    .then(() => {
        console.log("MongoDB connected");
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => console.error("MongoDB Error:", err));
