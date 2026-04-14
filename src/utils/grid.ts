import { Position, UnitInstance } from '../entities/unitInstance';

export class Grid {
  private width: number;
  private height: number;
  private occupied: Map<string, UnitInstance> = new Map();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  isOccupied(pos: Position): boolean {
    return this.occupied.has(this.positionKey(pos));
  }

  getUnitAt(pos: Position): UnitInstance | undefined {
    return this.occupied.get(this.positionKey(pos));
  }

  occupy(pos: Position, unit: UnitInstance): void {
    this.occupied.set(this.positionKey(pos), unit);
  }

  vacate(pos: Position): void {
    this.occupied.delete(this.positionKey(pos));
  }

  moveUnit(from: Position, to: Position, unit: UnitInstance): void {
    this.vacate(from);
    this.occupy(to, unit);
  }

  getAllOccupiedPositions(): Array<{ pos: Position; unit: UnitInstance }> {
    const result: Array<{ pos: Position; unit: UnitInstance }> = [];
    for (const [key, unit] of this.occupied) {
      const [x, y] = key.split(',').map(Number);
      result.push({ pos: { x, y }, unit });
    }
    return result;
  }

  private positionKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
