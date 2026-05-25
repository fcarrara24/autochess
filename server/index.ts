import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from './game/GameEngine';
import { NetworkManager } from './network/NetworkManagerNew';
import path from 'path';


const PORT = process.env.PORT || 3000;

// Simple static file server
const getContentType = (filePath: string) => {
  const ext = extname(filePath);
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
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
};

// Helper function to get or create player ID from cookies
const getPlayerIdFromRequest = (req: any): string => {
  const cookies = parseCookies(req.headers.cookie);

  if (cookies[COOKIE_NAME]) {
    return cookies[COOKIE_NAME];
  }

  // Generate new player ID if not exists
  const newPlayerId = uuidv4();
  return newPlayerId;
};

// Helper function to set player ID cookie
const setPlayerIdCookie = (res: any, playerId: string): void => {
  const cookieValue = `${COOKIE_NAME}=${encodeURIComponent(playerId)}; Max-Age=${COOKIE_MAX_AGE / 1000}; HttpOnly; SameSite=Lax; Path=/`;
  res.setHeader('Set-Cookie', cookieValue);
};

const server = createServer((req, res) => {
  // let filePath = `${__dirname}/../public${req.url}`;
  const publicDir = path.join(process.cwd(), 'public');

  let filePath = path.join(publicDir, req.url || '');

  // Default to index.html for root path
  // if (req.url === '/') {
  //   filePath = `${__dirname}/../public/index.html`;
  // }
  if (req.url === '/') {
    filePath = path.join(publicDir, 'index.html');
  }

  if (existsSync(filePath)) {
    const content = readFileSync(filePath);

    // Set player ID cookie for HTML files
    if (filePath.endsWith('.html')) {
      const playerId = getPlayerIdFromRequest(req);
      setPlayerIdCookie(res, playerId);
    }
    
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store player sessions for reconnection
const playerSessions: Map<string, { socketId: string; lastSeen: number }> = new Map();

// Initialize game engine
const gameEngine = new GameEngine();

// Initialize network manager
const networkManager = new NetworkManager(io, gameEngine);

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
