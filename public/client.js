class AutoBattlerClient {
    constructor() {
        this.socket = io();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = { width: 8, height: 3 };
        this.tileSize = { width: 80, height: 80 };
        
        this.gameState = null;
        this.playerSlot = null;
        this.selectedUnitType = null;
        this.isDragging = false;
        this.dragStartPos = null;
        
        // Refresh system
        this.lastRefreshTime = 0;
        this.placementRefreshInterval = 1000; // 1 second
        
        this.setupEventListeners();
        this.connect();
        this.startRefreshLoop();
    }

    setupEventListeners() {
        // Socket events
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected', 'Connected');
            this.socket.emit('joinGame');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected', 'Disconnected');
        });

        this.socket.on('playerSlot', (data) => {
            this.playerSlot = data.slot;
            console.log(`Assigned to slot ${this.playerSlot}`);
        });

        this.socket.on('gameState', (message) => {
            this.gameState = message.data;
            
            // Check for match winner (total victory)
            if (this.gameState.winner) {
                this.showMatchWinnerPopup(this.gameState.winner);
            } else if (this.gameState.drawResult) {
                // Check for draw result
                this.showDrawPopup();
            } else if (this.gameState.roundWinner) {
                // Check for round winner (but not match winner)
                this.showVictoryPopup(this.gameState.roundWinner);
            }
            
            // Always refresh in battle phase
            if (this.gameState.phase === 'BATTLE') {
                this.render();
                this.updateUI();
            } else {
                // In placement phase, refresh only on significant changes or time interval
                if (this.shouldRefreshPlacement()) {
                    this.render();
                    this.updateUI();
                    this.lastRefreshTime = Date.now();
                }
            }
        });

        this.socket.on('error', (message) => {
            const errorMessage = message?.data?.message || message?.message || message || 'Unknown error occurred';
            this.showError(errorMessage);
        });

        // Unit selection
        document.querySelectorAll('.unit-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.unit-option').forEach(opt => 
                    opt.classList.remove('selected')
                );
                option.classList.add('selected');
                this.selectedUnitType = option.dataset.unitType;
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    connect() {
        this.updateConnectionStatus('connected', 'Connecting...');
    }

    handleMouseDown(e) {
        if (!this.gameState || this.gameState.phase !== 'PLACEMENT') return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const gridPos = this.screenToGrid(x, y);
        if (!gridPos) return;

        const unit = this.getUnitAt(gridPos);
        
        if (e.button === 2 || e.shiftKey) {
            // Right click or shift-click to remove unit
            if (unit && unit.owner === this.playerSlot) {
                this.sendAction('remove', { unitId: unit.id, position: gridPos });
            }
        } else {
            // Left click to place or start dragging
            if (this.selectedUnitType && !unit) {
                this.sendAction('place', { 
                    unitType: this.selectedUnitType, 
                    position: gridPos 
                });
            } else if (unit && unit.owner === this.playerSlot) {
                this.isDragging = true;
                this.dragStartPos = gridPos;
            }
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragStartPos) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const gridPos = this.screenToGrid(x, y);
        if (!gridPos) return;

        // Show drag preview
        this.render();
        this.renderDragPreview(gridPos);
    }

    handleMouseUp(e) {
        if (!this.isDragging || !this.dragStartPos) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const gridPos = this.screenToGrid(x, y);
        if (!gridPos) return;

        const unit = this.getUnitAt(this.dragStartPos);
        if (unit && unit.owner === this.playerSlot) {
            this.sendAction('move', { 
                unitId: unit.id, 
                position: gridPos 
            });
        }

        this.isDragging = false;
        this.dragStartPos = null;
    }

    sendAction(type, data) {
        const action = {
            type,
            timestamp: Date.now(),
            ...data
        };
        
        this.socket.emit('playerAction', action);
    }

    screenToGrid(screenX, screenY) {
        const gridX = Math.floor(screenX / this.tileSize.width);
        const gridY = Math.floor(screenY / this.tileSize.height);
        
        if (gridX >= 0 && gridX < this.gridSize.width && 
            gridY >= 0 && gridY < this.gridSize.height) {
            return { x: gridX, y: gridY };
        }
        return null;
    }

    gridToScreen(gridX, gridY) {
        return {
            x: gridX * this.tileSize.width,
            y: gridY * this.tileSize.height
        };
    }

    getUnitAt(pos) {
        if (!this.gameState) return null;
        
        for (const player of this.gameState.players) {
            for (const unit of player.units) {
                if (unit.position.x === pos.x && unit.position.y === pos.y) {
                    return unit;
                }
            }
        }
        return null;
    }

    render() {
        if (!this.gameState) return;

        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw units
        this.drawUnits();

        // Draw phase overlay
        if (this.gameState.phase === 'PLACEMENT') {
            this.drawPlacementOverlay();
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;

        // Draw grid lines
        for (let x = 0; x <= this.gridSize.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.tileSize.width, 0);
            this.ctx.lineTo(x * this.tileSize.width, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.gridSize.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.tileSize.height);
            this.ctx.lineTo(this.canvas.width, y * this.tileSize.height);
            this.ctx.stroke();
        }

        // Draw player areas with proper coloring based on current player
        if (this.playerSlot === 'PLAYER_A') {
            // Player A's area (left side) - normal color
            this.ctx.fillStyle = 'rgba(33, 150, 243, 0.1)'; // Blue
            this.ctx.fillRect(0, 0, 4 * this.tileSize.width, this.canvas.height);
            
            // Player B's area (right side) - grayed out
            this.ctx.fillStyle = 'rgba(128, 128, 128, 0.2)'; // Gray
            this.ctx.fillRect(4 * this.tileSize.width, 0, 4 * this.tileSize.width, this.canvas.height);
        } else {
            // Player B's area (right side) - normal color
            this.ctx.fillStyle = 'rgba(244, 67, 54, 0.1)'; // Red
            this.ctx.fillRect(4 * this.tileSize.width, 0, 4 * this.tileSize.width, this.canvas.height);
            
            // Player A's area (left side) - grayed out
            this.ctx.fillStyle = 'rgba(128, 128, 128, 0.2)'; // Gray
            this.ctx.fillRect(0, 0, 4 * this.tileSize.width, this.canvas.height);
        }

        // Draw area divider
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(4 * this.tileSize.width, 0);
        this.ctx.lineTo(4 * this.tileSize.width, this.canvas.height);
        this.ctx.stroke();
    }

    drawUnits() {
        if (!this.gameState) return;

        for (const player of this.gameState.players) {
            for (const unit of player.units) {
                if (unit.stats.hp <= 0) continue; // Skip dead units
                
                const pos = this.gridToScreen(unit.position.x, unit.position.y);
                this.drawUnit(pos, unit, player.slot === this.playerSlot);
            }
        }
    }

    drawUnit(pos, unit, isOwnUnit) {
        const centerX = pos.x + this.tileSize.width / 2;
        const centerY = pos.y + this.tileSize.height / 2;
        const radius = 25;

        // Draw unit circle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        
        if (unit.owner === 'A') {
            this.ctx.fillStyle = isOwnUnit ? '#2196F3' : '#1976D2';
        } else {
            this.ctx.fillStyle = isOwnUnit ? '#f44336' : '#d32f2f';
        }
        this.ctx.fill();

        // Draw unit border
        this.ctx.strokeStyle = isOwnUnit ? '#fff' : '#ccc';
        this.ctx.lineWidth = isOwnUnit ? 3 : 2;
        this.ctx.stroke();

        // Draw unit type
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(unit.type === 'melee' ? 'M' : 'R', centerX, centerY - 5);

        // Draw HP bar
        const hpPercentage = unit.stats.hp / unit.stats.maxHp;
        const barWidth = 40;
        const barHeight = 4;
        const barX = centerX - barWidth / 2;
        const barY = centerY + 15;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        this.ctx.fillStyle = hpPercentage > 0.5 ? '#4CAF50' : 
                            hpPercentage > 0.25 ? '#FF9800' : '#f44336';
        this.ctx.fillRect(barX, barY, barWidth * hpPercentage, barHeight);
    }

    drawPlacementOverlay() {
        if (!this.playerSlot) return;

        this.ctx.fillStyle = 'rgba(76, 175, 80, 0.8)';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('PLACEMENT PHASE', this.canvas.width / 2, 30);
    }

    renderDragPreview(targetPos) {
        if (!this.dragStartPos) return;

        const unit = this.getUnitAt(this.dragStartPos);
        if (!unit) return;

        const targetScreen = this.gridToScreen(targetPos.x, targetPos.y);
        
        // Draw preview
        this.ctx.globalAlpha = 0.5;
        this.drawUnit(targetScreen, unit, true);
        this.ctx.globalAlpha = 1.0;

        // Draw line from original to target
        const startScreen = this.gridToScreen(this.dragStartPos.x, this.dragStartPos.y);
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x + this.tileSize.width / 2, startScreen.y + this.tileSize.height / 2);
        this.ctx.lineTo(targetScreen.x + this.tileSize.width / 2, targetScreen.y + this.tileSize.height / 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    updateUI() {
        if (!this.gameState) return;

        // Update phase
        const phaseElement = document.getElementById('phase');
        phaseElement.textContent = this.gameState.phase;
        phaseElement.style.color = this.gameState.phase === 'PLACEMENT' ? '#4CAF50' : '#FF9800';

        // Update timer
        const timerElement = document.getElementById('timer');
        const elapsed = Date.now() - this.gameState.roundStartTime;
        const timeLimit = this.gameState.phase === 'PLACEMENT' ? 
                         this.gameState.placementTimeLimit : 
                         this.gameState.battleTimeLimit;
        const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
        timerElement.textContent = remaining;

        // Update round
        document.getElementById('round').textContent = this.gameState.currentRound;
        
        // Update game counter
        document.getElementById('gameNumber').textContent = this.gameState.totalGames + 1;

        // Update scores
        const playerA = this.gameState.players.find(p => p.slot === 'A');
        const playerB = this.gameState.players.find(p => p.slot === 'B');
        
        document.getElementById('scoreA').textContent = playerA ? playerA.score : 0;
        document.getElementById('scoreB').textContent = playerB ? playerB.score : 0;

        // Show winner if game ended
        if (this.gameState.winner) {
            this.showError(`Player ${this.gameState.winner} wins the match!`, 10000);
        }
    }

    updateConnectionStatus(status, message) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = message;
        statusElement.className = status;
    }

    startRefreshLoop() {
        // Refresh every second in placement phase
        setInterval(() => {
            if (this.gameState && this.gameState.phase === 'PLACEMENT') {
                this.render();
                this.updateUI();
                this.lastRefreshTime = Date.now();
            }
        }, this.placementRefreshInterval);
    }
    
    shouldRefreshPlacement() {
        const now = Date.now();
        const timeSinceLastRefresh = now - this.lastRefreshTime;
        
        // Refresh if enough time has passed
        if (timeSinceLastRefresh >= this.placementRefreshInterval) {
            return true;
        }
        
        // Could add more conditions here for opponent interactions
        // For now, just time-based refresh
        return false;
    }
    
    showError(message, duration = 3000) {
        const popup = document.getElementById('errorPopup');
        popup.textContent = message;
        popup.style.display = 'block';

        setTimeout(() => {
            popup.style.display = 'none';
        }, duration);
    }
    
    showVictoryPopup(winner) {
        const popup = document.getElementById('victoryPopup');
        
        if (winner === this.playerSlot) {
            popup.textContent = 'Hai vinto!';
            popup.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        } else {
            popup.textContent = 'Hai perso!';
            popup.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
        }
        
        popup.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            popup.style.display = 'none';
        }, 5000);
    }
    
    showMatchWinnerPopup(winner) {
        const popup = document.getElementById('matchWinnerPopup');
        
        if (winner === this.playerSlot) {
            popup.textContent = '🏆 VITTORIA TOTALE! 🏆';
            popup.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
        } else {
            popup.textContent = '💔 SCONFITTA TOTALE 💔';
            popup.style.background = 'linear-gradient(135deg, #8B4513, #A0522D)';
        }
        
        popup.style.display = 'block';
        
        // Keep visible indefinitely (game ends)
        // No auto-hide needed as the match is over
    }
    
    showDrawPopup() {
        const popup = document.getElementById('drawPopup');
        popup.textContent = '🤝 PAREGGIO! 🤝';
        popup.style.background = 'linear-gradient(135deg, #9E9E9E, #757575)';
        popup.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            popup.style.display = 'none';
        }, 5000);
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AutoBattlerClient();
});
