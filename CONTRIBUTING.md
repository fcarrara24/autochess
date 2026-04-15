# 🤝 Contributing to Autochess Simulator

Grazie per il tuo interesse a contribuire! Questa guida ti aiuterà a iniziare.

## 🚀 Quick Start

### 1. Setup Development Environment

```bash
# Forka il repository
git clone <your-fork-url>
cd autochess

# Installa dipendenze
npm install

# Crea branch per la tua feature
git checkout -b feature/your-feature-name

# Compila in sviluppo
npm run dev
```

### 2. Esegui Test

```bash
# Test unitari
npm test

# Test CLI
npm run run-match -- --deckA turtle --deckB aggro

# Test web interface
npm run web
```

## 🏗️ Architettura del Progetto

### Struttura Directory

```
src/
├── core/           # Motore di simulazione (NO MODIFICHE SENZA DISCUSSIONE)
├── entities/        # Entità del gioco (unità, team, deck)
├── utils/          # Utilità riutilizzabili
├── cli/            # Interfaccia linea comando
└── types/          # TypeScript type definitions
```

### Principi di Design

1. **Determinismo**: Ogni esecuzione con stesso seed = stesso risultato
2. **Modularità**: Ogni modulo ha responsabilità chiara
3. **Type Safety**: TypeScript strict mode obbligatorio
4. **Performance**: O(1) per operazioni critiche
5. **Testability**: Ogni funzione deve essere testabile

## 📝 Guidelines di Sviluppo

### Code Style

```typescript
// ✅ Buono
interface UnitTemplate {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
}

function createUnit(templateId: string, teamId: string): UnitInstance {
  return {
    id: generateUnitId(),
    templateId,
    teamId,
    position: { x: 0, y: 0 },
    currentHp: 0,
    lastMoveTick: -1,
    lastAttackTick: -1,
    alive: true
  };
}

// ❌ Cattivo
var unit = {
  id: "unit1",
  name: "Tank"
};
```

### Naming Conventions

- **Files**: `kebab-case.ts` (es: `unit-templates.ts`)
- **Classes**: `PascalCase` (es: `SimulationEngine`)
- **Interfaces**: `PascalCase` (es: `UnitTemplate`)
- **Functions**: `camelCase` (es: `createUnit`)
- **Constants**: `UPPER_SNAKE_CASE` (es: `MAX_TICKS`)
- **Variables**: `camelCase` (es: `currentTick`)

### TypeScript Rules

```typescript
// Usa readonly per dati immutabili
interface Config {
  readonly maxTicks: number;
  readonly gridSize: Size;
}

// Usa tipi specifici invece di any
function processUnits(units: UnitInstance[]): void {
  // Non: function processUnits(units: any[]): void
}

// Usa tipi union quando appropriato
type TeamId = 'teamA' | 'teamB';
type GamePhase = 'movement' | 'attack' | 'damage';
```

## 🧪 Testing Guidelines

### Tipi di Test

1. **Unit Tests**: Test singole funzioni
2. **Integration Tests**: Test interazione moduli
3. **End-to-End Tests**: Test simulazioni complete
4. **Performance Tests**: Test con molti dati

### Struttura Test

```typescript
// ✅ Test ben strutturato
describe('Movement System', () => {
  describe('SimplePathfinder', () => {
    it('should find nearest enemy', () => {
      const unit = createTestUnit({ position: { x: 0, y: 0 } });
      const enemy = createTestUnit({ position: { x: 3, y: 3 } });
      
      const pathfinder = new SimplePathfinder();
      const result = pathfinder.findNearestEnemy(unit, [enemy]);
      
      expect(result).toBe(enemy);
    });
    
    it('should calculate correct distance', () => {
      const pos1 = { x: 0, y: 0 };
      const pos2 = { x: 3, y: 4 };
      
      const distance = getDistance(pos1, pos2);
      
      expect(distance).toBe(7); // Manhattan distance
    });
  });
});
```

### Test Commands

```bash
# Esegui tutti i test
npm test

# Test in watch mode
npm run test:watch

# Test coverage
npm run test:coverage

# Test specifico file
npm test -- movement.test.ts
```

## 🐛 Bug Reporting

### Template Issue

```markdown
## Bug Description
**Title**: [Breve descrizione del bug]

### Environment
- OS: [Linux/macOS/Windows]
- Node.js: [versione]
- Browser: [se applicabile]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[Cosa dovrebbe succedere]

### Actual Behavior
[Cosa succede realmente]

### Additional Info
[Altre informazioni utili]
```

### Debug Information

```bash
# Abilita debug mode
DEBUG=true npm run run-match -- --deckA turtle --deckB aggro

# Verbose logging
VERBOSE=true npm run test

# Profile performance
PROFILE=true npm run run-batch -- --matches 1000
```

## 💡 Feature Requests

### Template Proposal

```markdown
## Feature Request
**Title**: [Breve descrizione della feature]

### Problem Description
[Problema che questa feature risolve]

### Proposed Solution
[Descrizione della soluzione proposta]

### Implementation Details
[Dettagli tecnici dell'implementazione]

### Alternatives Considered
[Alternative valutate e perché scartate]

### Additional Benefits
[Altri benefici di questa feature]
```

## 🔄 Development Workflow

### 1. Planning

- Discuti la feature in issue tracker
- Crea specification dettagliata
- Definisci acceptance criteria

### 2. Development

- Crea branch da `master`
- Sviluppa incrementalmente
- Test ogni modifica

### 3. Review

- Crea pull request
- Richiedi code review
- Apporta modifiche richieste

### 4. Merge

- Merge su `master` dopo approvazione
- Aggiorna documentazione
- Tagga release se necessario

## 📋 Pull Request Guidelines

### PR Template

```markdown
## Description
[Breve descrizione delle modifiche]

### Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

### Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### PR Requirements

1. **Clean History**: Commit atomici e messaggi chiari
2. **Tests**: Tutti i test devono passare
3. **Documentation**: Aggiorna docs per breaking changes
4. **No Merge Conflicts**: Risolvi tutti i conflitti

## 📚 Documentation

### Tipi di Documentazione

1. **Code Comments**: Commenta logica complessa
2. **API Docs**: Documenta funzioni pubbliche
3. **User Docs**: Guide per utenti finali
4. **Dev Docs**: Guide per sviluppatori

### Writing Guidelines

- Usa italiano per documentazione utente
- Usa inglese per codice e API
- Includi esempi pratici
- Mantieni documentazione aggiornata

## 🚀 Performance Guidelines

### Optimization Priorities

1. **Tick Processing**: O(n) per numero unità
2. **Grid Operations**: O(1) per lookup
3. **Memory Usage**: Evita memory leaks
4. **Determinism**: Non sacrificare determinismo per performance

### Profiling

```bash
# Profile CLI performance
node --prof dist/index.js

# Profile web performance
npm run build
npm run start:profile
```

## 🔒 Security Guidelines

### Principi

1. **Input Validation**: Valida tutti gli input
2. **No Code Execution**: Non eseguire codice utente
3. **Resource Limits**: Limita uso risorse
4. **Error Handling**: Gestisci gracefully errori

### Best Practices

```typescript
// ✅ Validazione input
function createDeck(name: string, units: UnitConfig[]): Deck {
  if (!name || name.length === 0) {
    throw new Error('Deck name is required');
  }
  
  if (!units || units.length === 0) {
    throw new Error('Deck must have at least one unit');
  }
  
  return DeckFactory.create(name, units);
}

// ✅ Error handling
try {
  const result = engine.runMatch(deckA, deckB);
  return result;
} catch (error) {
  console.error('Match failed:', error);
  return { winner: 'draw', duration: 0, survivors: { teamA: 0, teamB: 0 } };
}
```

## 🎯 Areas di Contributo

### High Priority

1. **Performance**: Ottimizzazione tick processing
2. **UI/UX**: Miglioramento interfaccia web
3. **Testing**: Aumento coverage test
4. **Documentation**: Miglioramento guide

### Medium Priority

1. **Features**: Nuove tipi unità/deck
2. **Analytics**: Statistiche avanzate
3. **Export**: Import/export configurazioni
4. **Localization**: Supporto multilingua

### Low Priority

1. **Polish**: Animazioni, effetti sonori
2. **Themes**: Personalizzazione UI
3. **Plugins**: Sistema plugin
4. **Mobile**: App mobile

## 🏆 Riconoscimenti

### Contributors

- **Code Contributors**: Features, bug fixes, performance
- **Documentation**: Guide, API docs, tutorials
- **Testing**: Test cases, bug reports
- **Design**: UI/UX, grafica
- **Community**: Supporto, feedback, idee

### Badge System

- 🐛 Bug Hunter: 5+ bug fix
- 🚀 Feature Hero: 3+ major features
- 🧪 Test Master: 100+ test cases
- 📚 Doc Wizard: Complete documentation section
- 🎯 Performance Guru: Significant optimizations

---

**🤝 Grazie per contribuire!**

Ogni contributo è apprezzato. Segui queste linee guida e aiuterai a mantenere il progetto di alta qualità!
