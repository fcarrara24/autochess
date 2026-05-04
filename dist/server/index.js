"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const fs_1 = require("fs");
const path_1 = require("path");
const GameEngine_1 = require("./game/GameEngine");
const NetworkManager_1 = require("./network/NetworkManager");
const PORT = process.env.PORT || 3000;
// Simple static file server
const getContentType = (filePath) => {
    const ext = (0, path_1.extname)(filePath);
    switch (ext) {
        case '.html': return 'text/html';
        case '.js': return 'text/javascript';
        case '.css': return 'text/css';
        default: return 'text/plain';
    }
};
const server = (0, http_1.createServer)((req, res) => {
    let filePath = `${__dirname}/../public${req.url}`;
    // Default to index.html for root path
    if (req.url === '/') {
        filePath = `${__dirname}/../public/index.html`;
    }
    if ((0, fs_1.existsSync)(filePath)) {
        const content = (0, fs_1.readFileSync)(filePath);
        res.writeHead(200, { 'Content-Type': getContentType(filePath) });
        res.end(content);
    }
    else {
        res.writeHead(404);
        res.end('Not Found');
    }
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
