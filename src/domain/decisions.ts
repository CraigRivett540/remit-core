import type { WfhRequest, DecisionType, AssessmentFactor, PriorDecision } from './types.js';
import { runConsistencyCheck } from './consistency.js';
import { JURISDICTION_PROFILES } from './jurisdictions.js';
import { stamp } from './audit.js';

export function selectLetterTemplate(request: WfhRequest, type: DecisionType): string {
  const prefix = JURISDICTION_PROFILES[request.jurisdiction].letterPrefix;
  const code = type === 'approved' ? '02' : type === 'modified' ? '03' : '04';
  return `${prefix}-${code}`;
}

export function completeAssessment(
  request: WfhRequest,
  factors: AssessmentFactor[],
  prior: readonly PriorDecision[],
  now: Date = new Date(),
): WfhRequest {
  const assessed: WfhRequest = { ...request, assessment: factors, assessmentComplete: true };
  const consistency = runConsistencyCheck(assessed, prior);
  return {
    ...assessed,
    consistency,
    status: consistency.state === 'flag' ? 'flagged' : 'pending',
    audit: [
      ...request.audit,
      stamp(now, 'Role-suitability assessment completed'),
      stamp(now, `Consistency check run — ${consistency.state === 'flag' ? 'FLAGGED' : 'CLEAR'}`),
    ],
  };
}

export interface DecisionGuard { allowed: boolean; reason?: string; }

export function canDecide(request: WfhRequest, type: DecisionType): DecisionGuard {
  if (!request.assessmentComplete) {
    return { allowed: false, reason: 'Assessment incomplete — complete the role-suitability assessment first.' };
  }
  const adverse = type === 'refused' || type === 'modified';
  if (request.consistency.state === 'flag' && adverse) {
    return {
      allowed: false,
      reason:
        'Consistency flag unresolved — align with the comparator or record a distinguishing factor before an adverse decision.',
    };
  }
  return { allowed: true };
}

export function decide(request: WfhRequest, type: DecisionType, ground: string, now: Date = new Date()): WfhRequest {
  const guard = canDecide(request, type);
  if (!guard.allowed) throw new Error(guard.reason);
  const letterTemplate = selectLetterTemplate(request, type);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return {
    ...request,
    status: type,
    decision: { type, ground, letterTemplate, decidedAt: now.toISOString() },
    audit: [
      ...request.audit,
      stamp(now, `${label} — ground recorded`),
      stamp(now, `Decision letter ${letterTemplate} generated and issued`),
    ],
  };
}
