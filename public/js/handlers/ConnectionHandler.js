class ConnectionHandler {
    constructor(client) {
        this.client = client;
    }

    setupEventListeners() {
        // Socket events
        this.client.socket.on('connect', () => {
            this.updateConnectionStatus('connected', 'Connected');
            // Send persistent ID for reconnection
            this.client.socket.emit('joinGame', { persistentId: this.client.persistentId });
        });

        this.client.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected', 'Disconnected');
        });

        this.client.socket.on('playerSlot', (data) => {
            this.client.playerSlot = data.slot;
            // Store persistent ID for future reconnections
            if (data.persistentId) {
                this.client.persistentId = data.persistentId;
            }
        });

        this.client.socket.on('gameState', (message) => {
            this.handleGameStateUpdate(message);
        });

        this.client.socket.on('error', (message) => {
            this.showError(message.data.message);
        });
    }

    handleGameStateUpdate(message) {
        const previousPhase = this.client.gameState ? this.client.gameState.phase : null;
        this.client.gameState = message.data;
        
        // Check for match winner (total victory)
        if (this.client.gameState.winner && this.client.shownPopups.matchWinner !== this.client.gameState.winner) {
            this.showMatchWinnerPopup(this.client.gameState.winner);
            this.client.shownPopups.matchWinner = this.client.gameState.winner;
        }
        
        // Check for round winner
        if (this.client.gameState.roundWinner && this.client.shownPopups.roundWinner !== this.client.gameState.roundWinner) {
            this.showRoundWinnerPopup(this.client.gameState.roundWinner);
            this.client.shownPopups.roundWinner = this.client.gameState.roundWinner;
        }
        
        // Check for draw result
        if (this.client.gameState.drawResult && this.client.shownPopups.drawResult !== this.client.gameState.drawResult) {
            this.showDrawPopup();
            this.client.shownPopups.drawResult = this.client.gameState.drawResult;
        }
        
        // Reset popups when starting new round
        if (previousPhase && previousPhase === 'BATTLE' && this.client.gameState.phase === 'PLACEMENT') {
            this.resetRoundPopups();
        }
        
        this.updateUI();
    }

    updateConnectionStatus(status, text) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = text;
        statusElement.className = status;
    }

    showError(message) {
        const errorPopup = document.getElementById('errorPopup');
        errorPopup.textContent = message;
        errorPopup.style.display = 'block';
        
        setTimeout(() => {
            errorPopup.style.display = 'none';
        }, 3000);
    }

    showMatchWinnerPopup(winner) {
        const popup = document.getElementById('matchWinnerPopup');
        popup.textContent = winner === this.client.playerSlot ? 'HAI VINTO LA PARTITA!' : 'HAI PERSO LA PARTITA!';
        popup.style.display = 'block';
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 5000);
    }

    showRoundWinnerPopup(winner) {
        const popup = document.getElementById('victoryPopup');
        popup.textContent = winner === this.client.playerSlot ? 'HAI VINTO IL ROUND!' : 'HAI PERSO IL ROUND!';
        popup.style.display = 'block';
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
    }

    showDrawPopup() {
        const popup = document.getElementById('drawPopup');
        popup.style.display = 'block';
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
    }

    resetRoundPopups() {
        this.client.shownPopups.roundWinner = null;
        this.client.shownPopups.drawResult = null;
    }

    updateUI() {
        this.updateGameInfo();
        this.render();
    }

    updateGameInfo() {
        const phaseElement = document.getElementById('phase');
        const timerElement = document.getElementById('timer');
        const roundElement = document.getElementById('round');
        const gameNumberElement = document.getElementById('gameNumber');
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');

        phaseElement.textContent = this.client.gameState.phase;
        
        const timeLimit = this.client.gameState.phase === 'PLACEMENT' 
            ? this.client.gameState.placementTimeLimit 
            : this.client.gameState.battleTimeLimit;
        const timeElapsed = Date.now() - this.client.gameState.roundStartTime;
        const timeRemaining = Math.max(0, Math.ceil((timeLimit - timeElapsed) / 1000));
        timerElement.textContent = timeRemaining;
        
        roundElement.textContent = this.client.gameState.currentRound;
        gameNumberElement.textContent = Math.min(this.client.gameState.totalGames + 1, this.client.gameState.maxGames);
        
        const playerA = this.client.gameState.players.find(p => p.slot === 'A');
        const playerB = this.client.gameState.players.find(p => p.slot === 'B');
        scoreAElement.textContent = playerA ? playerA.wins : 0;
        scoreBElement.textContent = playerB ? playerB.wins : 0;
    }
}
