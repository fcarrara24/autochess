import { Unit, Position } from './types';

export class Grid {
  public readonly width = 8;
  public readonly height = 3;
  public tiles: (Unit | null)[][];

  constructor() {
    this.tiles = Array(this.height).fill(null).map(() => 
      Array(this.width).fill(null)
    );
  }

  isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.width && 
           pos.y >= 0 && pos.y < this.height;
  }

  isOccupied(pos: Position): boolean {
    if (!this.isValidPosition(pos)) return false;
    return this.tiles[pos.y][pos.x] !== null;
  }

  getUnitAt(pos: Position): Unit | null {
    if (!this.isValidPosition(pos)) return null;
    return this.tiles[pos.y][pos.x];
  }

  setUnitAt(pos: Position, unit: Unit | null): void {
    if (!this.isValidPosition(pos)) return;
    this.tiles[pos.y][pos.x] = unit;
  }

  moveUnit(from: Position, to: Position): boolean {
    if (!this.isValidPosition(from) || !this.isValidPosition(to)) return false;
    if (this.isOccupied(to)) return false;

    const unit = this.getUnitAt(from);
    if (!unit) return false;

    this.setUnitAt(from, null);
    this.setUnitAt(to, unit);
    unit.position = { ...to };
    return true;
  }

  removeUnit(pos: Position): Unit | null {
    if (!this.isValidPosition(pos)) return null;
    const unit = this.getUnitAt(pos);
    this.setUnitAt(pos, null);
    return unit;
  }

  getManhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  isInRange(pos1: Position, pos2: Position, range: number): boolean {
    return this.getManhattanDistance(pos1, pos2) <= range;
  }

  getNeighbors(pos: Position): Position[] {
    const neighbors: Position[] = [];
    const directions = [
      { x: 0, y: -1 }, // up
      { x: 0, y: 1 },  // down
      { x: -1, y: 0 }, // left
      { x: 1, y: 0 },  // right
      { x: -1, y: -1 }, // up-left
      { x: 1, y: -1 },  // up-right
      { x: -1, y: 1 },  // down-left
      { x: 1, y: 1 }    // down-right
    ];

    for (const dir of directions) {
      const newPos = { x: pos.x + dir.x, y: pos.y + dir.y };
      if (this.isValidPosition(newPos)) {
        neighbors.push(newPos);
      }
    }

    return neighbors;
  }

  getForwardInteractionLine(pos: Position, playerSlot: 'A' | 'B'): Position[] {
    const direction = playerSlot === 'A' ? 1 : -1;
    return [
      { x: pos.x + direction, y: pos.y },
      { x: pos.x + direction, y: pos.y - 1 },
      { x: pos.x + direction, y: pos.y + 1 }
    ].filter(p => this.isValidPosition(p));
  }

  clear(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = null;
      }
    }
  }

  clone(): Grid {
    const newGrid = new Grid();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        newGrid.tiles[y][x] = this.tiles[y][x];
      }
    }
    return newGrid;
  }
}
