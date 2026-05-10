class AutoBattlerClient {
    constructor() {
        this.socket = io();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = { width: 9, height: 3 };
        this.tileSize = { width: 80, height: 80 };
        
        this.gameState = null;
        this.playerSlot = null;
        this.selectedUnitType = null;
        this.isDragging = false;
        this.dragStartPos = null;
        
        // Refresh system
        this.lastRefreshTime = 0;
        this.placementRefreshInterval = 1000; // 1 second
        
        // Track shown popups to prevent duplicates
        this.shownPopups = {
            roundWinner: null,
            drawResult: null,
            matchWinner: null
        };
        
        this.persistentId = this.getPersistentId();
        this.setupEventListeners();
        this.connect();
        this.startRefreshLoop();
        this.setupPopupCloseHandlers();
    }

    // Get persistent ID from cookie
    getPersistentId() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'autochess_session') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    setupEventListeners() {
        // Socket events
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected', 'Connected');
            // Send persistent ID for reconnection
            this.socket.emit('joinGame', { persistentId: this.persistentId });
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected', 'Disconnected');
        });

        this.socket.on('playerSlot', (data) => {
            this.playerSlot = data.slot;
            // Store persistent ID for future reconnections
            if (data.persistentId) {
                this.persistentId = data.persistentId;
            }
        });

        this.socket.on('gameState', (message) => {
            const previousPhase = this.gameState ? this.gameState.phase : null;
            this.gameState = message.data;
            
            // Check for match winner (total victory)
            if (this.gameState.winner && this.shownPopups.matchWinner !== this.gameState.winner) {
                this.showMatchWinnerPopup(this.gameState.winner);
                this.shownPopups.matchWinner = this.gameState.winner;
            } else if (this.gameState.drawResult && !this.shownPopups.drawResult) {
                // Check for draw result
                this.showDrawPopup();
                this.shownPopups.drawResult = true;
            } else if (this.gameState.roundWinner && this.shownPopups.roundWinner !== this.gameState.roundWinner) {
                // Check for round winner (but not match winner)
                this.showVictoryPopup(this.gameState.roundWinner);
                this.shownPopups.roundWinner = this.gameState.roundWinner;
            }
            
            // Reset popup tracking when starting new round
            if (previousPhase === 'BATTLE' && this.gameState.phase === 'PLACEMENT') {
                this.shownPopups = {
                    roundWinner: null,
                    drawResult: null,
                    matchWinner: null
                };
            }
            
            // Force refresh if phase changed
            const phaseChanged = previousPhase && previousPhase !== this.gameState.phase;
            
            // Always refresh in battle phase
            if (this.gameState.phase === 'BATTLE') {
                this.render();
                this.updateUI();
            } else if (phaseChanged || this.shouldRefreshPlacement()) {
                // In placement phase, refresh if phase changed or time interval passed
                this.render();
                this.updateUI();
                this.lastRefreshTime = Date.now();
            }
        });

        this.socket.on('error', (message) => {
            const errorMessage = message?.data?.message || message?.message || message || 'Unknown error occurred';
            this.showError(errorMessage);
        });

        // Unit selection
        document.querySelectorAll('.unit-option').forEach(option => {
            // Mouse selection
            option.addEventListener('click', (e) => {
                this.selectUnit(option);
            });
            
            // Keyboard navigation
            option.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectUnit(option);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.focusNextUnit(option);
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.focusPreviousUnit(option);
                }
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '1') this.selectUnitByType('melee');
            if (e.key === '2') this.selectUnitByType('ranged');
            if (e.key === '3') this.selectUnitByType('thrower');
            if (e.key === '4') this.selectUnitByType('tank');
            if (e.key === 'Escape') this.clearSelection();
        });
    }

    selectUnit(option) {
        document.querySelectorAll('.unit-option').forEach(opt => 
            opt.classList.remove('selected')
        );
        option.classList.add('selected');
        this.selectedUnitType = option.dataset.unitType;
        
        // Announce selection for screen readers
        this.announceSelection(option);
    }

    focusNextUnit(currentOption) {
        const options = Array.from(document.querySelectorAll('.unit-option'));
        const currentIndex = options.indexOf(currentOption);
        const nextIndex = (currentIndex + 1) % options.length;
        options[nextIndex].focus();
    }

    focusPreviousUnit(currentOption) {
        const options = Array.from(document.querySelectorAll('.unit-option'));
        const currentIndex = options.indexOf(currentOption);
        const prevIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
        options[prevIndex].focus();
    }

    selectUnitByType(unitType) {
        const option = document.querySelector(`[data-unit-type="${unitType}"]`);
        if (option) {
            this.selectUnit(option);
            option.focus();
        }
    }

    clearSelection() {
        document.querySelectorAll('.unit-option').forEach(opt => 
            opt.classList.remove('selected')
        );
        this.selectedUnitType = null;
        
        // Announce clear selection
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = 'Selection cleared';
        announcement.style.position = 'absolute';
        announcement.style.left = '-9999px';
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    announceSelection(option) {
        const unitType = option.dataset.unitType;
        const label = option.getAttribute('aria-label');
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Selected: ${label}`;
        announcement.style.position = 'absolute';
        announcement.style.left = '-9999px';
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
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

        // Draw AoE effects
        this.drawAoEEffects();

        // Draw phase overlay
        if (this.gameState.phase === 'PLACEMENT') {
            this.drawPlacementOverlay();
        }
    }

    drawGrid() {
        // Clear canvas with high contrast background
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid lines with better contrast
        this.ctx.strokeStyle = '#444444';
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

        // Draw player areas with better contrast and visual distinction
        if (this.playerSlot === 'PLAYER_A') {
            // Player A's area (left side) - normal color with better contrast
            this.ctx.fillStyle = 'rgba(33, 150, 243, 0.15)'; // Blue with more opacity
            this.ctx.fillRect(0, 0, 4 * this.tileSize.width, this.canvas.height);
            
            // Player B's area (right side) - more subtle
            this.ctx.fillStyle = 'rgba(100, 100, 100, 0.1)'; // Lighter gray
            this.ctx.fillRect(4 * this.tileSize.width, 0, 4 * this.tileSize.width, this.canvas.height);
        } else {
            // Player B's area (right side) - normal color with better contrast
            this.ctx.fillStyle = 'rgba(244, 67, 54, 0.15)'; // Red with more opacity
            this.ctx.fillRect(4 * this.tileSize.width, 0, 4 * this.tileSize.width, this.canvas.height);
            
            // Player A's area (left side) - more subtle
            this.ctx.fillStyle = 'rgba(100, 100, 100, 0.1)'; // Lighter gray
            this.ctx.fillRect(0, 0, 4 * this.tileSize.width, this.canvas.height);
        }

        // Draw area divider with higher contrast
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(4 * this.tileSize.width, 0);
        this.ctx.lineTo(4 * this.tileSize.width, this.canvas.height);
        this.ctx.stroke();
        
        // Draw grid coordinates for accessibility (optional)
        if (this.gameState && this.gameState.phase === 'PLACEMENT') {
            this.drawGridCoordinates();
        }
    }

    drawGridCoordinates() {
        this.ctx.fillStyle = '#888888';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        for (let x = 0; x < this.gridSize.width; x++) {
            for (let y = 0; y < this.gridSize.height; y++) {
                const pos = this.gridToScreen(x, y);
                this.ctx.fillText(`${x},${y}`, pos.x + 10, pos.y + 10);
            }
        }
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
        const radius = unit.type === 'tank' ? 28 : 25; // Tanks are slightly larger

        // Draw unit shadow for depth
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(centerX + 2, centerY + 2, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw unit circle with gradient
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        if (unit.owner === 'A') {
            gradient.addColorStop(0, isOwnUnit ? '#42A5F5' : '#2196F3');
            gradient.addColorStop(1, isOwnUnit ? '#1565C0' : '#1976D2');
        } else {
            gradient.addColorStop(0, isOwnUnit ? '#EF5350' : '#f44336');
            gradient.addColorStop(1, isOwnUnit ? '#C62828' : '#d32f2f');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw unit border with high contrast
        this.ctx.strokeStyle = isOwnUnit ? '#ffffff' : '#e0e0e0';
        this.ctx.lineWidth = isOwnUnit ? 3 : 2;
        this.ctx.stroke();
        
        // Draw AoE indicator for thrower units
        if (unit.type === 'thrower') {
            this.ctx.strokeStyle = '#FFD700'; // Gold color for AoE
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw AoE range indicator
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw shield indicator for tank units
        if (unit.type === 'tank') {
            this.ctx.strokeStyle = '#4CAF50'; // Green for defense
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 2]);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Draw unit type
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        let unitLabel;
        switch (unit.type) {
            case 'melee':
                unitLabel = 'M';
                break;
            case 'ranged':
                unitLabel = 'R';
                break;
            case 'thrower':
                unitLabel = 'Th';
                break;
            case 'tank':
                unitLabel = 'Tk';
                break;
            default:
                unitLabel = '?';
        }
        this.ctx.fillText(unitLabel, centerX, centerY - 5);

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

    drawAoEEffects() {
        if (!this.gameState || this.gameState.phase !== 'BATTLE') return;
        
        // Check for thrower units and draw AoE indicators during battle
        for (const player of this.gameState.players) {
            for (const unit of player.units) {
                if (unit.type === 'thrower' && unit.state === 'ATTACK' && unit.targetId) {
                    const target = this.findUnitById(unit.targetId);
                    if (target) {
                        const pos = this.gridToScreen(target.position.x, target.position.y);
                        
                        // Draw AoE explosion effect
                        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                        this.ctx.strokeStyle = '#FFD700';
                        this.ctx.lineWidth = 3;
                        
                        // Draw expanding circles for explosion effect
                        for (let i = 1; i <= 3; i++) {
                            this.ctx.globalAlpha = 0.3 / i;
                            this.ctx.beginPath();
                            this.ctx.arc(
                                pos.x + this.tileSize.width / 2,
                                pos.y + this.tileSize.height / 2,
                                10 * i,
                                0,
                                Math.PI * 2
                            );
                            this.ctx.stroke();
                        }
                        this.ctx.globalAlpha = 1.0;
                        
                        // Draw AoE area highlight
                        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
                        this.ctx.fillRect(
                            pos.x - this.tileSize.width,
                            pos.y - this.tileSize.height,
                            this.tileSize.width * 3,
                            this.tileSize.height * 3
                        );
                    }
                }
            }
        }
    }

    findUnitById(unitId) {
        if (!this.gameState) return null;
        
        for (const player of this.gameState.players) {
            for (const unit of player.units) {
                if (unit.id === unitId) {
                    return unit;
                }
            }
        }
        return null;
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

    setupPopupCloseHandlers() {
        // Close popups when clicking outside
        document.addEventListener('click', (e) => {
            const popups = ['victoryPopup', 'drawPopup'];
            
            popups.forEach(popupId => {
                const popup = document.getElementById(popupId);
                if (popup && popup.style.display === 'block' && !popup.contains(e.target)) {
                    // Clear timeout if exists
                    if (popup.dataset.timeout) {
                        clearTimeout(parseInt(popup.dataset.timeout));
                    }
                    popup.style.display = 'none';
                }
            });
        });
    }
    
    startRefreshLoop() {
        // Refresh every second in placement phase, more frequently in battle
        setInterval(() => {
            if (this.gameState) {
                if (this.gameState.phase === 'PLACEMENT') {
                    this.render();
                    this.updateUI();
                    this.lastRefreshTime = Date.now();
                } else if (this.gameState.phase === 'BATTLE') {
                    // More frequent refresh during battle for HP updates
                    this.render();
                    this.updateUI();
                }
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
        
        // Hide after 3 seconds
        const timeout = setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
        
        // Store timeout to clear if clicked outside
        popup.dataset.timeout = timeout;
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
        
        // Hide after 3 seconds
        const timeout = setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
        
        // Store timeout to clear if clicked outside
        popup.dataset.timeout = timeout;
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AutoBattlerClient();
});
