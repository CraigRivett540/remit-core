import { describe, it, expect } from 'vitest';
import { completeAssessment, canDecide, decide, selectLetterTemplate } from '../src/domain/decisions.js';
import { renderDecisionLetter } from '../src/domain/letters.js';
import { PRIOR, request, FIXED } from './fixtures.js';

const factors = [{ key: 'client', label: 'Client interaction', rating: 'green' as const, note: 'Low' }];

describe('decision workflow', () => {
  it('completing assessment runs the consistency check and flags when comparable exists', () => {
    const r = completeAssessment(request({ assessmentComplete: false }), factors, PRIOR, FIXED);
    expect(r.assessmentComplete).toBe(true);
    expect(r.status).toBe('flagged');
    expect(r.consistency.state).toBe('flag');
  });

  it('blocks an adverse decision while the consistency flag is unresolved', () => {
    const flagged = completeAssessment(request({ assessmentComplete: false }), factors, PRIOR, FIXED);
    expect(canDecide(flagged, 'refused').allowed).toBe(false);
    expect(() => decide(flagged, 'refused', 'On-site needs', FIXED)).toThrow();
  });

  it('allows aligning (approve) even while flagged', () => {
    const flagged = completeAssessment(request({ assessmentComplete: false }), factors, PRIOR, FIXED);
    expect(canDecide(flagged, 'approved').allowed).toBe(true);
    const decided = decide(flagged, 'approved', 'Consistent with comparator', FIXED);
    expect(decided.status).toBe('approved');
    expect(decided.decision?.letterTemplate).toBe('EO-VIC-02');
  });

  it('blocks any decision before assessment is complete', () => {
    expect(canDecide(request({ assessmentComplete: false }), 'approved').allowed).toBe(false);
  });

  it('selects jurisdiction-correct letter templates', () => {
    expect(selectLetterTemplate(request({ jurisdiction: 'VIC' }), 'approved')).toBe('EO-VIC-02');
    expect(selectLetterTemplate(request({ jurisdiction: 'NSW' }), 'refused')).toBe('FW-NSW-04');
    expect(selectLetterTemplate(request({ jurisdiction: 'WA' }), 'modified')).toBe('FW-WA-03');
  });

  it('renders a counsel-flagged decision letter', () => {
    const cleared = request({ jurisdiction: 'NSW', roleKey: 'software engineer' });
    const decided = decide(cleared, 'approved', 'Role suits remote work', FIXED);
    const letter = renderDecisionLetter(decided);
    expect(letter).toContain('COUNSEL TO APPROVE');
    expect(letter).toContain('FW-NSW-02');
  });
});
