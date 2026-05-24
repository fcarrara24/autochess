"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const fs_1 = require("fs");
const path_1 = require("path");
const uuid_1 = require("uuid");
const GameEngine_1 = require("./game/GameEngine");
const NetworkManagerNew_1 = require("./network/NetworkManagerNew");
const path_2 = __importDefault(require("path"));
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
// Cookie setup
const COOKIE_NAME = 'autochess_session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
// Simple cookie parsing function
const parseCookies = (cookieHeader) => {
    const cookies = {};
    if (!cookieHeader)
        return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
            cookies[name] = decodeURIComponent(value);
        }
    });
    return cookies;
};
// Helper function to get or create player ID from cookies
const getPlayerIdFromRequest = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[COOKIE_NAME]) {
        return cookies[COOKIE_NAME];
    }
    // Generate new player ID if not exists
    const newPlayerId = (0, uuid_1.v4)();
    return newPlayerId;
};
// Helper function to set player ID cookie
const setPlayerIdCookie = (res, playerId) => {
    const cookieValue = `${COOKIE_NAME}=${encodeURIComponent(playerId)}; Max-Age=${COOKIE_MAX_AGE / 1000}; HttpOnly; SameSite=Lax; Path=/`;
    res.setHeader('Set-Cookie', cookieValue);
};
const server = (0, http_1.createServer)((req, res) => {
    // let filePath = `${__dirname}/../public${req.url}`;
    const publicDir = path_2.default.join(process.cwd(), 'public');
    let filePath = path_2.default.join(publicDir, req.url || '');
    // Default to index.html for root path
    // if (req.url === '/') {
    //   filePath = `${__dirname}/../public/index.html`;
    // }
    if (req.url === '/') {
        filePath = path_2.default.join(publicDir, 'index.html');
    }
    if ((0, fs_1.existsSync)(filePath)) {
        const content = (0, fs_1.readFileSync)(filePath);
        // Set player ID cookie for HTML files
        if (filePath.endsWith('.html')) {
            const playerId = getPlayerIdFromRequest(req);
            setPlayerIdCookie(res, playerId);
        }
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
        methods: ["GET", "POST"],
        credentials: true
    }
});
// Store player sessions for reconnection
const playerSessions = new Map();
// Initialize game engine
const gameEngine = new GameEngine_1.GameEngine();
// Initialize network manager
const networkManager = new NetworkManagerNew_1.NetworkManager(io, gameEngine);
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
