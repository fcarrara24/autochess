export interface Deck {
  name: string;
  units: Array<{
    templateId: string;
    count: number;
  }>;
}

export class DeckFactory {
  static create(name: string, units: Array<{ templateId: string; count: number }>): Deck {
    return {
      name,
      units: [...units]
    };
  }

  static getUnitCount(deck: Deck): number {
    return deck.units.reduce((total, unit) => total + unit.count, 0);
  }

  static validate(deck: Deck): boolean {
    return deck.units.length > 0 && 
           deck.units.every(unit => unit.count > 0 && unit.templateId.length > 0);
  }
}

export const PREDEFINED_DECKS: Record<string, Deck> = {
  turtle: {
    name: "Turtle",
    units: [
      { templateId: "tank", count: 3 },
      { templateId: "ranged", count: 2 }
    ]
  },
  aggro: {
    name: "Aggro", 
    units: [
      { templateId: "fast_melee", count: 4 },
      { templateId: "melee", count: 1 }
    ]
  },
  balanced: {
    name: "Balanced",
    units: [
      { templateId: "tank", count: 1 },
      { templateId: "melee", count: 2 },
      { templateId: "ranged", count: 2 }
    ]
  }
};
