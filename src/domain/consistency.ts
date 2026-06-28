import type { WfhRequest, PriorDecision, ConsistencyResult } from './types.js';

// The signature guardrail: catch inconsistent (potentially discriminatory / adverse) decisions
// BEFORE they ship, by comparing against prior decisions for materially comparable roles.
const ADVERSE_ACTION_NOTE =
  'Refusing on grounds already waived for a materially comparable role may constitute adverse action ' +
  '(Fair Work Act 2009 (Cth) Pt 3-1, s 351) and indirect discrimination.';

export function findComparable(request: WfhRequest, prior: readonly PriorDecision[]): PriorDecision | undefined {
  return prior.find(
    (p) =>
      p.roleKey === request.roleKey &&
      p.jurisdiction === request.jurisdiction &&
      (p.status === 'approved' || p.status === 'modified'),
  );
}

export function runConsistencyCheck(request: WfhRequest, prior: readonly PriorDecision[]): ConsistencyResult {
  const c = findComparable(request, prior);
  if (c) {
    return {
      state: 'flag',
      comparatorId: c.id,
      rationale: ADVERSE_ACTION_NOTE,
      recommendation:
        'Align the decision with the comparator, or record a material distinguishing factor before refusing.',
    };
  }
  return {
    state: 'clear',
    rationale: 'No comparable role decided on conflicting terms. The decision is internally consistent.',
  };
}

export function resolveByDistinguishing(result: ConsistencyResult, factor: string): ConsistencyResult {
  if (result.state !== 'flag') return result;
  return { ...result, state: 'resolved', note: `Distinguishing factor recorded: ${factor}` };
}

export function resolveByAlignment(result: ConsistencyResult): ConsistencyResult {
  if (result.state !== 'flag') return result;
  return {
    ...result,
    state: 'resolved',
    note: `Resolved by aligning with comparable approval ${result.comparatorId ?? ''}`.trim(),
  };
}
