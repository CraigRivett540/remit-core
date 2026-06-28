import { describe, it, expect } from 'vitest';
import { runConsistencyCheck, findComparable, resolveByDistinguishing, resolveByAlignment } from '../src/domain/consistency';
import { PRIOR, request } from './fixtures';

describe('consistency engine', () => {
  it('flags a comparable approved role in the same jurisdiction', () => {
    const r = runConsistencyCheck(request(), PRIOR);
    expect(r.state).toBe('flag');
    expect(r.comparatorId).toBe('WFH-2026-0129');
    expect(r.rationale).toMatch(/adverse action/i);
  });

  it('clears when no comparable role exists (different jurisdiction)', () => {
    const r = runConsistencyCheck(request({ jurisdiction: 'NSW' }), PRIOR);
    expect(r.state).toBe('clear');
    expect(r.comparatorId).toBeUndefined();
  });

  it('clears when role differs', () => {
    const r = runConsistencyCheck(request({ roleKey: 'software engineer' }), PRIOR);
    expect(r.state).toBe('clear');
  });

  it('ignores prior refusals as comparators', () => {
    const r = findComparable(request(), [{ id: 'X', roleKey: 'account manager', jurisdiction: 'VIC', status: 'refused' }]);
    expect(r).toBeUndefined();
  });

  it('resolves on a recorded distinguishing factor', () => {
    const resolved = resolveByDistinguishing(runConsistencyCheck(request(), PRIOR), 'Supervises a co-located team');
    expect(resolved.state).toBe('resolved');
    expect(resolved.note).toContain('Supervises');
  });

  it('resolves by alignment to the comparator', () => {
    const resolved = resolveByAlignment(runConsistencyCheck(request(), PRIOR));
    expect(resolved.state).toBe('resolved');
    expect(resolved.note).toContain('WFH-2026-0129');
  });
});
