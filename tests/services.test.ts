import { describe, it, expect, beforeEach } from 'vitest';
import { seedDemo, type Store } from '../src/store/memory.js';
import * as wfh from '../src/services/wfh.js';
import * as whs from '../src/services/whs.js';
import * as outcomes from '../src/services/outcomes.js';
import { GuardError } from '../src/services/errors.js';

const NOW = new Date('2026-06-28T00:00:00Z');
let store: Store;
beforeEach(() => { store = seedDemo(); });
const PASS = [{ key: 'c', label: 'Client', rating: 'green' as const, note: 'Low' }];

describe('wfh service loop', () => {
  it('flags a new AM/VIC request against the seeded prior approval, then blocks refusal', () => {
    const r = wfh.create(store, { employee: 'Jordan Wells', role: 'Account Manager · Advisory', jurisdiction: 'VIC', days: '2 days', pattern: 'Mon & Tue' }, NOW);
    const assessed = wfh.assess(store, r.id, PASS, NOW);
    expect(assessed.status).toBe('flagged');
    expect(() => wfh.makeDecision(store, r.id, 'refused', 'x', NOW)).toThrow(GuardError);
  });

  it('approves by alignment, issues the VIC letter, and feeds the prior-decision pool', () => {
    const before = store.priorDecisions.length;
    const r = wfh.create(store, { employee: 'Jordan Wells', role: 'Account Manager · Advisory', jurisdiction: 'VIC', days: '2 days', pattern: 'Mon & Tue' }, NOW);
    wfh.assess(store, r.id, PASS, NOW);
    const decided = wfh.makeDecision(store, r.id, 'approved', 'Consistent with comparator', NOW);
    expect(decided.decision?.letterTemplate).toBe('EO-VIC-02');
    expect(store.priorDecisions.length).toBe(before + 1);
    expect(wfh.letter(store, r.id)).toContain('COUNSEL TO APPROVE');
  });

  it('unlocks a refusal after a distinguishing factor is recorded', () => {
    const r = wfh.create(store, { employee: 'Pat Lee', role: 'Account Manager · Advisory', jurisdiction: 'VIC', days: '2 days', pattern: 'Mon' }, NOW);
    wfh.assess(store, r.id, PASS, NOW);
    wfh.distinguish(store, r.id, 'Supervises a co-located team', NOW);
    const refused = wfh.makeDecision(store, r.id, 'refused', 'Inherent on-site requirement', NOW);
    expect(refused.status).toBe('refused');
    expect(refused.decision?.letterTemplate).toBe('EO-VIC-04');
  });
});

describe('whs + outcomes services', () => {
  it('completes a due hazard review and records an outcome cycle review', () => {
    const h = whs.review(store, 'HZ-024', '2026-12-20', NOW);
    expect(h.status).toBe('reviewed');
    const c = outcomes.review(store, 'OC-2026-Q3-014', NOW);
    expect(c.status).toBe('reviewed');
  });
});
