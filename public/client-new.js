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
        
        // Initialize handlers
        this.connectionHandler = new ConnectionHandler(this);
        this.gameHandler = new GameHandler(this);
        this.renderer = new Renderer(this);
        
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

    connect() {
        this.connectionHandler.setupEventListeners();
        this.gameHandler.setupEventListeners();
    }

    startRefreshLoop() {
        const refresh = () => {
            if (this.gameState && this.gameState.phase === 'PLACEMENT') {
                const now = Date.now();
                if (now - this.lastRefreshTime >= this.placementRefreshInterval) {
                    this.render();
                    this.lastRefreshTime = now;
                }
            }
            requestAnimationFrame(refresh);
        };
        requestAnimationFrame(refresh);
    }

    render() {
        this.renderer.render();
    }

    setupPopupCloseHandlers() {
        ['victoryPopup', 'matchWinnerPopup', 'drawPopup'].forEach(popupId => {
            const popup = document.getElementById(popupId);
            if (popup) {
                popup.addEventListener('click', () => {
                    popup.style.display = 'none';
                });
            }
        });
    }
}

// Initialize client when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AutoBattlerClient();
});
