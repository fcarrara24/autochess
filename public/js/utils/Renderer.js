class Renderer {
    constructor(client) {
        this.client = client;
    }

    render() {
        if (!this.client.gameState) return;

        this.clearCanvas();
        this.drawGrid();
        this.drawUnits();
        this.drawPlayerZones();
    }

    clearCanvas() {
        this.client.ctx.fillStyle = '#0a0a0a';
        this.client.ctx.fillRect(0, 0, this.client.canvas.width, this.client.canvas.height);
    }

    drawGrid() {
        this.client.ctx.strokeStyle = '#333';
        this.client.ctx.lineWidth = 1;

        // Draw vertical lines
        for (let x = 0; x <= this.client.gridSize.width; x++) {
            this.client.ctx.beginPath();
            this.client.ctx.moveTo(x * this.client.tileSize.width, 0);
            this.client.ctx.lineTo(x * this.client.tileSize.width, this.client.canvas.height);
            this.client.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.client.gridSize.height; y++) {
            this.client.ctx.beginPath();
            this.client.ctx.moveTo(0, y * this.client.tileSize.height);
            this.client.ctx.lineTo(this.client.canvas.width, y * this.client.tileSize.height);
            this.client.ctx.stroke();
        }
    }

    drawUnits() {
        if (!this.client.gameState || !this.client.gameState.grid) return;

        for (let y = 0; y < this.client.gridSize.height; y++) {
            for (let x = 0; x < this.client.gridSize.width; x++) {
                const unit = this.client.gameState.grid.tiles[y][x];
                if (unit) {
                    this.drawUnit(unit, x, y);
                }
            }
        }
    }

    drawUnit(unit, x, y) {
        const centerX = x * this.client.tileSize.width + this.client.tileSize.width / 2;
        const centerY = y * this.client.tileSize.height + this.client.tileSize.height / 2;
        const radius = this.client.tileSize.width * 0.3;

        // Set color based on owner
        if (unit.owner === 'A') {
            this.client.ctx.fillStyle = '#2196F3';
        } else {
            this.client.ctx.fillStyle = '#f44336';
        }

        // Draw unit circle
        this.client.ctx.beginPath();
        this.client.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.client.ctx.fill();

        // Draw unit type
        this.client.ctx.fillStyle = 'white';
        this.client.ctx.font = '12px Arial';
        this.client.ctx.textAlign = 'center';
        this.client.ctx.textBaseline = 'middle';
        this.client.ctx.fillText(
            unit.type === 'melee' ? 'M' : 'R',
            centerX,
            centerY
        );

        // Draw HP bar
        this.drawHPBar(unit, x, y);
    }

    drawHPBar(unit, x, y) {
        const barWidth = this.client.tileSize.width * 0.8;
        const barHeight = 4;
        const barX = x * this.client.tileSize.width + (this.client.tileSize.width - barWidth) / 2;
        const barY = y * this.client.tileSize.height + 5;

        const hpPercent = unit.stats.hp / unit.stats.maxHp;

        // Background
        this.client.ctx.fillStyle = '#333';
        this.client.ctx.fillRect(barX, barY, barWidth, barHeight);

        // HP
        if (hpPercent > 0.5) {
            this.client.ctx.fillStyle = '#4CAF50';
        } else if (hpPercent > 0.25) {
            this.client.ctx.fillStyle = '#FF9800';
        } else {
            this.client.ctx.fillStyle = '#f44336';
        }
        this.client.ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    }

    drawPlayerZones() {
        if (!this.client.playerSlot) return;

        // Draw player A zone (left side)
        this.client.ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        this.client.ctx.fillRect(0, 0, this.client.tileSize.width * 3, this.client.canvas.height);

        // Draw player B zone (right side)
        this.client.ctx.fillStyle = 'rgba(244, 67, 54, 0.1)';
        this.client.ctx.fillRect(
            this.client.tileSize.width * (this.client.gridSize.width - 3),
            0,
            this.client.tileSize.width * 3,
            this.client.canvas.height
        );

        // Highlight current player's zone
        if (this.client.playerSlot === 'A') {
            this.client.ctx.strokeStyle = 'rgba(33, 150, 243, 0.5)';
            this.client.ctx.lineWidth = 2;
            this.client.ctx.strokeRect(0, 0, this.client.tileSize.width * 3, this.client.canvas.height);
        } else {
            this.client.ctx.strokeStyle = 'rgba(244, 67, 54, 0.5)';
            this.client.ctx.lineWidth = 2;
            this.client.ctx.strokeRect(
                this.client.tileSize.width * (this.client.gridSize.width - 3),
                0,
                this.client.tileSize.width * 3,
                this.client.canvas.height
            );
        }
    }
}
