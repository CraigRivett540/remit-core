import { describe, it, expect } from 'vitest';
import { recordCycleReview } from '../src/domain/outcomes.js';
import { contract, FIXED } from './fixtures.js';

describe('outcome contracts', () => {
  it('records a cycle review with delivered count and retention audit', () => {
    const after = recordCycleReview(contract(), FIXED);
    expect(after.status).toBe('reviewed');
    expect(after.audit[0]?.event).toMatch(/2 of 3 outcomes delivered/);
    expect(after.audit.length).toBe(2);
  });
});
