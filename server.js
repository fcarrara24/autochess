const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Import del motore di simulazione
const { SimulationEngine, SimulationConfig } = require('./dist/core/engine');
const { UnitTemplateManager } = require('./dist/entities/unitTemplate');
const { PREDEFINED_DECKS } = require('./dist/entities/deck');

class AutochessServer {
    constructor() {
        this.port = 3000;
        this.clients = new Set();
        this.simulator = null;
        this.httpServer = null;
        this.wsServer = null;
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
                case 'advancePhase':
                    this.advancePhase();
                    break;
                case 'previousPhase':
                    this.previousPhase();
                    break;
                case 'toggleAutoplay':
                    this.toggleAutoplay();
                    break;
                case 'populateSquad':
                    this.populateSquad();
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    startSimulation(deckA = 'turtle', deckB = 'aggro') {
        if (!this.simulator) {
            this.initializeSimulator();
        }
        
        const result = this.simulator.startSimulation(deckA, deckB);
        this.broadcast({
            type: 'simulationStarted',
            result: result
        });
    }

    pauseSimulation() {
        if (this.simulator) {
            this.simulator.pauseSimulation();
            this.broadcast({
                type: 'simulationPaused'
            });
        }
    }

    stepSimulation() {
        if (this.simulator) {
            const result = this.simulator.stepSimulation();
            this.broadcast({
                type: 'simulationStepped',
                result: result
            });
        }
    }

    resetSimulation() {
        if (this.simulator) {
            this.simulator.resetSimulation();
            this.broadcast({
                type: 'simulationReset'
            });
        }
    }

    advancePhase() {
        if (this.simulator) {
            const result = this.simulator.advancePhase();
            this.broadcast({
                type: 'phaseAdvanced',
                result: result
            });
        }
    }

    previousPhase() {
        if (this.simulator) {
            const result = this.simulator.previousPhase();
            this.broadcast({
                type: 'phasePrevious',
                result: result
            });
        }
    }

    toggleAutoplay() {
        if (this.simulator) {
            const result = this.simulator.toggleAutoplay();
            this.broadcast({
                type: 'autoplayToggled',
                result: result
            });
        }
    }

    populateSquad() {
        if (!this.simulator) {
            this.initializeSimulator();
        }
        
        const result = this.simulator.populateSquad();
        this.broadcast({
            type: 'squadPopulated',
            result: result
        });
    }

    initializeSimulator() {
        // Inizializza template manager
        const templateManager = new UnitTemplateManager();
        
        // Setup templates (copiato da index.ts)
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
            enableLogging: false,
            gridSize: {
                width: 12,
                height: 6
            }
        };

        // Crea motore di simulazione
        const engine = new SimulationEngine(templateManager, config);

        // Crea wrapper per simulator (compatibilità con web interface)
        this.simulator = {
            engine: engine,
            templateManager: templateManager,
            config: config,
            currentTick: 0,
            isRunning: false,
            isPaused: false,
            units: [],
            moveHistory: [],
            currentMoveIndex: -1,
            autoplayEnabled: false,
            autoplayInterval: null,

            startSimulation: function(deckA, deckB) {
                const teamA = this.engine.createTeamFromDeck(PREDEFINED_DECKS[deckA], 'teamA', this.templateManager);
                const teamB = this.engine.createTeamFromDeck(PREDEFINED_DECKS[deckB], 'teamB', this.templateManager);
                
                this.units = [...teamA.units, ...teamB.units];
                this.currentTick = 0;
                this.isRunning = true;
                this.isPaused = false;
                this.moveHistory = [];
                this.currentMoveIndex = -1;

                return {
                    success: true,
                    units: this.units,
                    tick: this.currentTick
                };
            },

            pauseSimulation: function() {
                this.isPaused = true;
                return { paused: true };
            },

            stepSimulation: function() {
                if (!this.isRunning || this.isPaused) return { error: 'Simulation not running' };
                
                // Implementazione step semplificata
                this.currentTick++;
                
                return {
                    success: true,
                    tick: this.currentTick,
                    units: this.units
                };
            },

            resetSimulation: function() {
                this.currentTick = 0;
                this.isRunning = false;
                this.isPaused = false;
                this.units = [];
                this.moveHistory = [];
                this.currentMoveIndex = -1;
                
                return { reset: true };
            },

            advancePhase: function() {
                if (!this.units || this.units.length === 0) {
                    this.populateSquad();
                    return { advanced: true, phase: 'movement' };
                }

                this.currentTick++;
                
                return {
                    success: true,
                    tick: this.currentTick,
                    units: this.units,
                    phase: 'movement'
                };
            },

            previousPhase: function() {
                if (this.currentTick > 0) {
                    this.currentTick--;
                    return { success: true, tick: this.currentTick };
                }
                return { error: 'No previous phase' };
            },

            toggleAutoplay: function() {
                this.autoplayEnabled = !this.autoplayEnabled;
                return { autoplay: this.autoplayEnabled };
            },

            populateSquad: function() {
                // Popola con squadra predefinita
                this.units = [
                    // Team A (verde) - Squadra Turtle
                    {
                        id: 'teamA_tank_0',
                        templateId: 'tank',
                        position: { x: 0, y: 1 },
                        teamId: 'teamA',
                        currentHp: 150,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamA_tank_1',
                        templateId: 'tank',
                        position: { x: 0, y: 2 },
                        teamId: 'teamA',
                        currentHp: 150,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamA_tank_2',
                        templateId: 'tank',
                        position: { x: 0, y: 3 },
                        teamId: 'teamA',
                        currentHp: 150,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamA_ranged_0',
                        templateId: 'ranged',
                        position: { x: 1, y: 1 },
                        teamId: 'teamA',
                        currentHp: 60,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamA_ranged_1',
                        templateId: 'ranged',
                        position: { x: 1, y: 3 },
                        teamId: 'teamA',
                        currentHp: 60,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    
                    // Team B (rosso) - Squadra Aggro
                    {
                        id: 'teamB_fast_melee_0',
                        templateId: 'fast_melee',
                        position: { x: 11, y: 0 },
                        teamId: 'teamB',
                        currentHp: 80,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamB_fast_melee_1',
                        templateId: 'fast_melee',
                        position: { x: 11, y: 1 },
                        teamId: 'teamB',
                        currentHp: 80,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamB_fast_melee_2',
                        templateId: 'fast_melee',
                        position: { x: 11, y: 2 },
                        teamId: 'teamB',
                        currentHp: 80,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamB_fast_melee_3',
                        templateId: 'fast_melee',
                        position: { x: 11, y: 3 },
                        teamId: 'teamB',
                        currentHp: 80,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    },
                    {
                        id: 'teamB_melee_0',
                        templateId: 'melee',
                        position: { x: 11, y: 4 },
                        teamId: 'teamB',
                        currentHp: 100,
                        lastMoveTick: -1,
                        lastAttackTick: -1,
                        alive: true,
                        state: 'idle',
                        targetId: null,
                        lastTargetChangeTick: -1
                    }
                ];

                this.isRunning = true;
                this.currentTick = 0;

                return {
                    success: true,
                    units: this.units,
                    message: 'Griglia popolata con squadra predefinita!'
                };
            }
        };
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
