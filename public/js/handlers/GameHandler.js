class GameHandler {
    constructor(client) {
        this.client = client;
    }

    setupEventListeners() {
        // Unit selection
        document.querySelectorAll('.unit-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectUnit(e.target.closest('.unit-option'));
            });
        });

        // Canvas events
        this.client.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        this.client.canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });

        this.client.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.client.canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });

        this.client.canvas.addEventListener('mouseleave', (e) => {
            this.handleMouseLeave(e);
        });
    }

    selectUnit(unitElement) {
        document.querySelectorAll('.unit-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        unitElement.classList.add('selected');
        this.client.selectedUnitType = unitElement.dataset.unitType;
    }

    handleCanvasClick(e) {
        if (!this.client.gameState || this.client.gameState.phase !== 'PLACEMENT') return;
        if (!this.client.playerSlot) return;

        const rect = this.client.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.client.tileSize.width);
        const y = Math.floor((e.clientY - rect.top) / this.client.tileSize.height);

        if (x < 0 || x >= this.client.gridSize.width || y < 0 || y >= this.client.gridSize.height) {
            return;
        }

        const position = { x, y };

        if (this.client.selectedUnitType) {
            this.placeUnit(position);
        } else {
            this.selectUnitAt(position);
        }
    }

    handleMouseDown(e) {
        if (!this.client.gameState || this.client.gameState.phase !== 'PLACEMENT') return;
        
        const rect = this.client.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.client.tileSize.width);
        const y = Math.floor((e.clientY - rect.top) / this.client.tileSize.height);

        if (x < 0 || x >= this.client.gridSize.width || y < 0 || y >= this.client.gridSize.height) {
            return;
        }

        const position = { x, y };
        const unit = this.getUnitAt(position);

        if (unit && unit.owner === this.client.playerSlot) {
            this.client.isDragging = true;
            this.client.dragStartPos = position;
            this.client.canvas.style.cursor = 'grabbing';
        }
    }

    handleMouseMove(e) {
        if (!this.client.isDragging) return;

        const rect = this.client.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.client.tileSize.width);
        const y = Math.floor((e.clientY - rect.top) / this.client.tileSize.height);

        if (x < 0 || x >= this.client.gridSize.width || y < 0 || y >= this.client.gridSize.height) {
            return;
        }

        this.render();
        this.renderDragPreview({ x, y });
    }

    handleMouseUp(e) {
        if (!this.client.isDragging) return;

        const rect = this.client.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.client.tileSize.width);
        const y = Math.floor((e.clientY - rect.top) / this.client.tileSize.height);

        if (x < 0 || x >= this.client.gridSize.width || y < 0 || y >= this.client.gridSize.height) {
            this.client.isDragging = false;
            this.client.dragStartPos = null;
            this.client.canvas.style.cursor = 'crosshair';
            this.render();
            return;
        }

        const position = { x, y };

        if (this.canMoveTo(position)) {
            this.moveUnit(this.client.dragStartPos, position);
        }

        this.client.isDragging = false;
        this.client.dragStartPos = null;
        this.client.canvas.style.cursor = 'crosshair';
        this.render();
    }

    handleMouseLeave(e) {
        if (this.client.isDragging) {
            this.client.isDragging = false;
            this.client.dragStartPos = null;
            this.client.canvas.style.cursor = 'crosshair';
            this.render();
        }
    }

    placeUnit(position) {
        const action = {
            type: 'place',
            unitType: this.client.selectedUnitType,
            position: position,
            timestamp: Date.now()
        };

        this.client.socket.emit('playerAction', action);
    }

    selectUnitAt(position) {
        const unit = this.getUnitAt(position);
        if (unit && unit.owner === this.client.playerSlot) {
            // Select the unit type for placing similar units
            const unitOption = document.querySelector(`[data-unit-type="${unit.type}"]`);
            if (unitOption) {
                this.selectUnit(unitOption);
            }
        }
    }

    moveUnit(from, to) {
        const unit = this.getUnitAt(from);
        if (!unit) return;

        const action = {
            type: 'move',
            unitId: unit.id,
            position: to,
            timestamp: Date.now()
        };

        this.client.socket.emit('playerAction', action);
    }

    getUnitAt(position) {
        if (!this.client.gameState) return null;
        return this.client.gameState.grid.tiles[position.y][position.x];
    }

    canMoveTo(position) {
        if (!this.client.gameState) return false;
        return !this.client.gameState.grid.isOccupied(position);
    }

    renderDragPreview(position) {
        if (!this.client.dragStartPos) return;

        this.client.ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
        this.client.ctx.fillRect(
            position.x * this.client.tileSize.width,
            position.y * this.client.tileSize.height,
            this.client.tileSize.width,
            this.client.tileSize.height
        );

        // Draw line from start to current position
        this.client.ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
        this.client.ctx.lineWidth = 2;
        this.client.ctx.setLineDash([5, 5]);
        this.client.ctx.beginPath();
        this.client.ctx.moveTo(
            this.client.dragStartPos.x * this.client.tileSize.width + this.client.tileSize.width / 2,
            this.client.dragStartPos.y * this.client.tileSize.height + this.client.tileSize.height / 2
        );
        this.client.ctx.lineTo(
            position.x * this.client.tileSize.width + this.client.tileSize.width / 2,
            position.y * this.client.tileSize.height + this.client.tileSize.height / 2
        );
        this.client.ctx.stroke();
        this.client.ctx.setLineDash([]);
    }
}
