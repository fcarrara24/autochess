"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const ecstatic_1 = __importDefault(require("ecstatic"));
const GameEngine_1 = require("./game/GameEngine");
const NetworkManager_1 = require("./network/NetworkManager");
const PORT = process.env.PORT || 3000;
// Create HTTP server with static file serving
const staticMiddleware = (0, ecstatic_1.default)({
    root: `${__dirname}/../public`,
    showDir: false,
    autoIndex: true,
});
const server = (0, http_1.createServer)((req, res) => {
    staticMiddleware(req, res);
});
// Create Socket.IO server
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
// Initialize game engine
const gameEngine = new GameEngine_1.GameEngine();
// Initialize network manager
const networkManager = new NetworkManager_1.NetworkManager(io, gameEngine);
// Start server
server.listen(PORT, () => {
    console.log(`Auto-battler server running on port ${PORT}`);
    console.log(`Static files served from: ${__dirname}/../public`);
    console.log(`Open http://localhost:${PORT} to play`);
});
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    gameEngine.shutdown();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
