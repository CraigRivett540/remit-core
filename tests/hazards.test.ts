import { describe, it, expect } from 'vitest';
import { validateControls, completeReview } from '../src/domain/hazards';
import { hazard, FIXED } from './fixtures';

describe('WHS hierarchy-of-controls guardrail', () => {
  it('rejects a VIC psychosocial hazard with only lower-order controls', () => {
    const v = validateControls(hazard({ controls: [{ tier: 'lower', text: 'Awareness training' }] }));
    expect(v.valid).toBe(false);
    expect(v.issues.join(' ')).toMatch(/higher-order control is required/i);
  });

  it('requires a higher-order control to be primary (VIC)', () => {
    const v = validateControls(hazard({ controls: [{ tier: 'higher', text: 'Redesign workload' }] }));
    expect(v.valid).toBe(false);
    expect(v.issues.join(' ')).toMatch(/primary/i);
  });

  it('accepts a VIC psychosocial hazard with a primary higher-order control', () => {
    expect(validateControls(hazard()).valid).toBe(true);
  });

  it('does not impose the modified hierarchy outside VIC, but warns on lower-only', () => {
    const v = validateControls(hazard({ jurisdiction: 'NSW', controls: [{ tier: 'lower', text: 'Training' }] }));
    expect(v.valid).toBe(true);
    expect(v.warnings.length).toBeGreaterThan(0);
  });

  it('completing a review updates status and appends an audit trail', () => {
    const before = hazard({ status: 'due' });
    const after = completeReview(before, '2026-12-20', FIXED);
    expect(after.status).toBe('reviewed');
    expect(after.reviewDate).toBe('2026-12-20');
    expect(after.audit.length).toBe(before.audit.length + 2);
  });
});
