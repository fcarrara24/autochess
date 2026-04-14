export interface UnitTemplate {
  id: string;
  name: string;
  hp: number;
  damage: number;
  range: number;
  movementCooldown: number;
  attackCooldown: number;
  tags: string[];
}

export class UnitTemplateManager {
  private templates: Map<string, UnitTemplate> = new Map();

  register(template: UnitTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`UnitTemplate with id '${template.id}' already exists`);
    }
    this.templates.set(template.id, template);
  }

  get(id: string): UnitTemplate | undefined {
    return this.templates.get(id);
  }

  getAll(): UnitTemplate[] {
    return Array.from(this.templates.values());
  }

  hasTag(templateId: string, tag: string): boolean {
    const template = this.get(templateId);
    return template ? template.tags.includes(tag) : false;
  }
}
