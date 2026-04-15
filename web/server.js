const http = require('http');
const fs = require('fs');
const path = require('path');

class AutochessServer {
    constructor() {
        this.port = 3001;
        this.clients = new Set();
        this.server = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            // Enable CORS
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            if (req.method === 'GET') {
                this.serveFile(req, res);
            } else if (req.method === 'POST') {
                this.handleAPI(req, res);
            } else {
                res.writeHead(405, 'Method Not Allowed');
                res.end();
            }
        });

        this.server.listen(this.port, () => {
            console.log(`🚀 Autochess Server running on http://localhost:${this.port}`);
            console.log('📁 Open your browser and navigate to: http://localhost:${this.port}');
        });
        
        return this.server;
    }

    serveFile(req, res) {
        let filePath = req.url === '/' ? 'index.html' : req.url.substring(1);
        
        // Security: prevent directory traversal
        filePath = filePath.replace(/\.\./g, '').replace(/\/+/g, '');
        
        const fullPath = path.join(__dirname, filePath);
        
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                res.writeHead(404, 'Not Found');
                res.end('File not found');
                return;
            }

            const ext = path.extname(fullPath).toLowerCase();
            const contentType = this.getContentType(ext);
            
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
        });
    }

    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        return types[ext] || 'text/plain';
    }

    handleAPI(req, res) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                switch (data.action) {
                    case 'startSimulation':
                        this.startSimulation(data);
                        break;
                    case 'pauseSimulation':
                        this.pauseSimulation(data);
                        break;
                    case 'stepSimulation':
                        this.stepSimulation(data);
                        break;
                    case 'resetSimulation':
                        this.resetSimulation(data);
                        break;
                    default:
                        res.writeHead(400, 'Bad Request');
                        res.end(JSON.stringify({ error: 'Unknown action' }));
                        return;
                }

                res.writeHead(200, 'Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400, 'Bad Request');
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }

    startSimulation(data) {
        console.log('🎮 Starting simulation via API:', data);
        // Broadcast to all connected clients
        this.broadcast({ type: 'simulationStarted', data });
    }

    pauseSimulation(data) {
        console.log('⏸️ Pausing simulation via API:', data);
        this.broadcast({ type: 'simulationPaused', data });
    }

    stepSimulation(data) {
        console.log('⏭️ Stepping simulation via API:', data);
        this.broadcast({ type: 'simulationStepped', data });
    }

    resetSimulation(data) {
        console.log('🔄 Resetting simulation via API:', data);
        this.broadcast({ type: 'simulationReset', data });
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        
        this.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(messageStr);
            }
        });
    }
}

// WebSocket upgrade handling
const WebSocket = require('ws');
const serverInstance = new AutochessServer();
const httpServer = serverInstance.start();

const wsServer = new WebSocket.Server({ server: httpServer });

wsServer.on('connection', (ws) => {
    console.log('📡 WebSocket client connected');
    server.clients.add(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received message:', data);

            // Broadcast to other clients
            server.clients.forEach(client => {
                if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (error) {
            console.error('❌ Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        server.clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

console.log('🌐 Autochess Web Server with WebSocket support started!');
