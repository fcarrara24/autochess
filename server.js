const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Import del motore di simulazione
const { SimulationEngine } = require('./dist/core/engine');
const { UnitTemplateManager } = require('./dist/entities/unitTemplate');
const { PREDEFINED_DECKS } = require('./dist/entities/deck');

class AutochessServer {
    constructor() {
        this.port = 3000;
        this.clients = new Set();
        this.simulator = null;
        this.httpServer = null;
        this.wsServer = null;
        this.autoplayInterval = null;
    }

    start() {
        // Crea server HTTP
        this.httpServer = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        // Crea server WebSocket
        this.wsServer = new WebSocket.Server({ server: this.httpServer });

        this.wsServer.on('connection', (ws) => {
            console.log('WebSocket client connected');
            this.clients.add(ws);

            ws.on('message', (message) => {
                this.handleWebSocketMessage(ws, message);
            });

            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
            });
        });

        this.httpServer.listen(this.port, () => {
            console.log(`\n=== Autochess Battle Simulator ===`);
            console.log(`Server running on http://localhost:${this.port}`);
            console.log(`WebSocket enabled for real-time updates`);
            console.log(`Open your browser and navigate to: http://localhost:${this.port}`);
            console.log(`=====================================\n`);
        });

        return this.httpServer;
    }

    handleRequest(req, res) {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            let filePath = req.url === '/' ? 'index.html' : req.url.substring(1);
            
            // Security: prevent directory traversal
            filePath = filePath.replace(/\.\./g, '').replace(/\/+/g, '');
            
            const fullPath = path.join(__dirname, filePath);
            
            if (!fs.existsSync(fullPath)) {
                res.writeHead(404, 'Not Found');
                res.end('File not found');
                return;
            }

            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                res.writeHead(403, 'Forbidden');
                res.end('Directory access forbidden');
                return;
            }

            const ext = path.extname(fullPath);
            const contentType = this.getContentType(ext);
            
            res.setHeader('Content-Type', contentType);
            res.writeHead(200);
            
            const fileStream = fs.createReadStream(fullPath);
            fileStream.pipe(res);
            
        } catch (error) {
            console.error('Error serving file:', error);
            res.writeHead(500, 'Internal Server Error');
            res.end('Internal server error');
        }
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
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
        return types[ext] || 'text/plain';
    }

    handleWebSocketMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'initialize':
                    this.initializeSimulator();
                    break;
                case 'startSimulation':
                    this.startSimulation(data.deckA, data.deckB);
                    break;
                case 'pauseSimulation':
                    this.pauseSimulation();
                    break;
                case 'stepSimulation':
                    this.stepSimulation();
                    break;
                case 'resetSimulation':
                    this.resetSimulation();
                    break;
                case 'toggleAutoplay':
                    this.toggleAutoplay();
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    initializeSimulator() {
        // Inizializza template manager
        const templateManager = new UnitTemplateManager();
        
        // Setup templates
        const templates = [
            {
                id: 'tank',
                name: 'Tank',
                hp: 150,
                damage: 20,
                range: 1,
                movementCooldown: 3,
                attackCooldown: 2,
                tags: ['melee', 'tank', 'slow']
            },
            {
                id: 'melee',
                name: 'Melee',
                hp: 100,
                damage: 30,
                range: 1,
                movementCooldown: 2,
                attackCooldown: 1,
                tags: ['melee', 'balanced']
            },
            {
                id: 'fast_melee',
                name: 'Fast Melee',
                hp: 80,
                damage: 25,
                range: 1,
                movementCooldown: 1,
                attackCooldown: 1,
                tags: ['melee', 'fast', 'glass_cannon']
            },
            {
                id: 'ranged',
                name: 'Ranged',
                hp: 60,
                damage: 35,
                range: 4,
                movementCooldown: 3,
                attackCooldown: 2,
                tags: ['ranged', 'glass_cannon']
            }
        ];

        templates.forEach(template => templateManager.register(template));

        // Crea configurazione simulazione
        const config = {
            maxTicks: 1000,
            enableLogging: true,
            gridSize: {
                width: 12,
                height: 6
            }
        };

        // Crea motore di simulazione
        const engine = new SimulationEngine(templateManager, config);

        this.simulator = {
            engine: engine,
            templateManager: templateManager,
            config: config,
            currentTick: 0,
            isRunning: false,
            isPaused: false,
            units: [],
            grid: null,
            autoplayEnabled: false
        };

        this.broadcast({
            type: 'simulatorInitialized',
            decks: Object.keys(PREDEFINED_DECKS)
        });
    }

    startSimulation(deckA, deckB) {
        if (!this.simulator) {
            this.initializeSimulator();
        }

        try {
            const teamA = this.simulator.engine.createTeamFromDeck(PREDEFINED_DECKS[deckA], 'teamA', this.simulator.templateManager);
            const teamB = this.simulator.engine.createTeamFromDeck(PREDEFINED_DECKS[deckB], 'teamB', this.simulator.templateManager);
            
            this.simulator.units = [...teamA.units, ...teamB.units];
            this.simulator.currentTick = 0;
            this.simulator.isRunning = true;
            this.simulator.isPaused = false;

            // Inizializza griglia
            this.simulator.grid = new (require('./dist/utils/grid')).Grid(
                this.simulator.config.gridSize.width, 
                this.simulator.config.gridSize.height
            );

            // Posiziona unità sulla griglia
            for (const unit of this.simulator.units) {
                if (unit.alive) {
                    this.simulator.grid.occupy(unit.position, unit);
                }
            }

            this.broadcast({
                type: 'simulationStarted',
                units: this.simulator.units,
                tick: this.simulator.currentTick,
                deckA: deckA,
                deckB: deckB
            });
        } catch (error) {
            console.error('Error starting simulation:', error);
            this.broadcast({
                type: 'error',
                message: 'Failed to start simulation: ' + error.message
            });
        }
    }

    pauseSimulation() {
        if (this.simulator) {
            this.simulator.isPaused = !this.simulator.isPaused;
            this.broadcast({
                type: 'simulationPaused',
                paused: this.simulator.isPaused
            });
        }
    }

    stepSimulation() {
        if (!this.simulator || !this.simulator.isRunning || this.simulator.isPaused) return;

        try {
            const { processTick } = require('./dist/core/tick');
            
            // Crea mappa templates
            const templates = new Map();
            for (const template of this.simulator.templateManager.getAll()) {
                templates.set(template.id, template);
            }
            
            // Processa tick
            const tickLog = processTick(this.simulator.currentTick, this.simulator.units, templates, this.simulator.grid);
            
            // Aggiorna posizione unità basata sui movimenti
            for (const move of tickLog.moves) {
                const unit = this.simulator.units.find(u => u.id === move.unitId);
                if (unit) {
                    this.simulator.grid.moveUnit(move.from, move.to, unit);
                    unit.position = { ...move.to };
                    unit.lastMoveTick = this.simulator.currentTick;
                }
            }
            
            // Applica danni
            for (const attack of tickLog.attacks) {
                const target = this.simulator.units.find(u => u.id === attack.targetId);
                if (target && target.alive) {
                    target.currentHp -= attack.damage;
                    if (target.currentHp <= 0) {
                        target.currentHp = 0;
                        target.alive = false;
                        this.simulator.grid.vacate(target.position);
                    }
                }
            }
            
            this.simulator.currentTick++;
            
            this.broadcast({
                type: 'simulationStepped',
                tick: this.simulator.currentTick,
                units: this.simulator.units,
                moves: tickLog.moves,
                attacks: tickLog.attacks,
                deaths: tickLog.deaths
            });
        } catch (error) {
            console.error('Error stepping simulation:', error);
            this.broadcast({
                type: 'error',
                message: 'Failed to step simulation: ' + error.message
            });
        }
    }

    resetSimulation() {
        if (this.simulator) {
            if (this.autoplayInterval) {
                clearInterval(this.autoplayInterval);
                this.autoplayInterval = null;
            }
            
            this.simulator.currentTick = 0;
            this.simulator.isRunning = false;
            this.simulator.isPaused = false;
            this.simulator.units = [];
            this.simulator.grid = null;
            this.simulator.autoplayEnabled = false;

            this.broadcast({
                type: 'simulationReset'
            });
        }
    }

    toggleAutoplay() {
        if (!this.simulator) return;

        this.simulator.autoplayEnabled = !this.simulator.autoplayEnabled;

        if (this.simulator.autoplayEnabled) {
            this.autoplayInterval = setInterval(() => {
                if (this.simulator && this.simulator.isRunning && !this.simulator.isPaused) {
                    this.stepSimulation();
                }
            }, 500);
        } else {
            if (this.autoplayInterval) {
                clearInterval(this.autoplayInterval);
                this.autoplayInterval = null;
            }
        }

        this.broadcast({
            type: 'autoplayToggled',
            autoplay: this.simulator.autoplayEnabled
        });
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }
}

// Avvia server
const server = new AutochessServer();
server.start();
