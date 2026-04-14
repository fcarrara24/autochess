export class DeterministicRNG {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  // Linear congruential generator (LCG)
  // Simple, fast, and deterministic
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  // For consistent ordering in arrays
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Reset to initial seed for reproducible simulations
  reset(seed?: number): void {
    this.seed = seed ?? 12345;
  }

  getSeed(): number {
    return this.seed;
  }
}

// Global deterministic RNG instance
export const deterministicRNG = new DeterministicRNG();

// Utility functions for deterministic behavior
export function deterministicSort<T>(array: T[], keyFn?: (item: T) => string): T[] {
  if (keyFn) {
    return array.sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
  }
  
  // Default sort by string representation
  return array.sort((a, b) => String(a).localeCompare(String(b)));
}

export function deterministicHash(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}
