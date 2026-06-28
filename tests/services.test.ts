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
  it('captures staff-entry previous-arrangement details for existing staff', () => {
    const created = wfh.create(store, {
      employee: 'Jordan Wells',
      role: 'Account Manager · Advisory',
      jurisdiction: 'VIC',
      days: '2 days',
      pattern: 'Mon & Tue',
      staffRecordType: 'existing',
      previousArrangement: '2 days · Tue & Thu',
      previousArrangementSince: '2025-01-10',
      previousArrangementNotes: 'Imported from prior arrangement record.',
    }, NOW);
    expect(created.staffEntry).toEqual({
      staffRecordType: 'existing',
      previousArrangement: '2 days · Tue & Thu',
      previousArrangementSince: '2025-01-10',
      previousArrangementNotes: 'Imported from prior arrangement record.',
    });
  });
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

  it('locks request edits after decision finalisation', () => {
    const r = wfh.create(store, { employee: 'Kim Dao', role: 'Analyst · Research', jurisdiction: 'QLD', days: '2 days', pattern: 'Tue & Thu' }, NOW);
    wfh.assess(store, r.id, PASS, NOW);
    wfh.makeDecision(store, r.id, 'approved', 'Consistent comparator pathway', NOW);
    expect(() => wfh.assess(store, r.id, PASS, NOW)).toThrow(GuardError);
    expect(() => wfh.makeDecision(store, r.id, 'modified', 'Post-final change', NOW)).toThrow(GuardError);
  });
});

describe('whs + outcomes services', () => {
  it('completes a due hazard review and records an outcome cycle review', () => {
    const h = whs.review(store, 'HZ-024', {
      nextReviewDate: '2026-12-20',
      finding: 'Higher-order controls remain effective',
      reviewer: 'System WHS Reviewer',
    }, NOW);
    expect(h.status).toBe('reviewed');
    const c = outcomes.review(store, 'OC-2026-Q3-014', {
      reviewerName: 'System Manager',
      summary: 'Delivery signals reviewed for cycle close.',
      signedOff: true,
    }, NOW);
    expect(c.status).toBe('reviewed');
  });

  it('supports hazard creation/update then enforces immutability after review', () => {
    const created = whs.create(store, {
      name: 'After-hours communications surge',
      type: 'psychosocial',
      jurisdiction: 'NSW',
      controls: [{ tier: 'higher', text: 'Work allocation redesign', primary: true }],
      consultation: 'Workers and HSR consulted.',
      triggers: ['Scheduled — 2026-09-01'],
      reviewDate: '2026-09-01',
    }, NOW);
    const updated = whs.update(store, created.id, { consultation: 'Consultation updated with additional worker feedback.' }, NOW);
    expect(updated.consultation).toMatch(/additional worker feedback/i);
    const reviewed = whs.review(store, created.id, {
      nextReviewDate: '2026-12-01',
      finding: 'Controls remain proportionate to risk.',
      reviewer: 'System WHS Reviewer',
    }, NOW);
    expect(reviewed.reviews.length).toBe(1);
    expect(() => whs.update(store, created.id, { reviewDate: '2027-01-01' }, NOW)).toThrow(GuardError);
  });

  it('supports contract creation/state sync then enforces immutability after cycle review', () => {
    const created = outcomes.create(store, {
      employee: 'Nora Kim',
      jurisdiction: 'VIC',
      period: 'Q4 2026',
      signalSource: 'CRM',
      outcomes: [
        { text: 'Renew two enterprise accounts', state: 'progress' },
        { text: 'Complete renewal playbook', state: 'notstarted' },
      ],
    }, NOW);
    expect(created.status).toBe('review');
    const synced = outcomes.updateOutcomes(store, created.id, [
      { text: 'Renew two enterprise accounts', state: 'done' },
      { text: 'Complete renewal playbook', state: 'progress' },
    ], NOW);
    expect(synced.status).toBe('ontrack');
    const reviewed = outcomes.review(store, created.id, {
      reviewerName: 'System Manager',
      summary: 'Quarterly outcomes reviewed and acknowledged.',
      signedOff: true,
    }, NOW);
    expect(reviewed.cycleReviews.length).toBe(1);
    expect(() => outcomes.updateOutcomes(store, created.id, synced.outcomes, NOW)).toThrow(GuardError);
  });
});
