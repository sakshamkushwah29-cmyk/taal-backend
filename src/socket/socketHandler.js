let io;

function setupSocket(server) {
    const socketIo = require("socket.io");
    io = socketIo(server, {
        cors: {
            origin: "*",
        },
    });

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("disconnect", () => {
            console.log("Client disconnected");
        });
    });
}

function getIO() {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
}

module.exports = { setupSocket, getIO };
