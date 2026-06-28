import type { Store } from '../store/memory.js';
import type { WfhRequest, AssessmentFactor, DecisionType, Jurisdiction } from '../domain/types.js';
import { completeAssessment, decide, canDecide } from '../domain/decisions.js';
import { resolveByDistinguishing, resolveByAlignment } from '../domain/consistency.js';
import { renderDecisionLetter } from '../domain/letters.js';
import { stamp } from '../domain/audit.js';
import { NotFoundError, GuardError } from './errors.js';

function upsert(store: Store, r: WfhRequest): WfhRequest {
  const i = store.requests.findIndex((x) => x.id === r.id);
  if (i >= 0) store.requests[i] = r; else store.requests.unshift(r);
  return r;
}
export function get(store: Store, id: string): WfhRequest {
  const r = store.requests.find((x) => x.id === id);
  if (!r) throw new NotFoundError(`Request ${id} not found`);
  return r;
}
export function list(store: Store): WfhRequest[] { return store.requests; }

export interface NewRequest { employee: string; role: string; jurisdiction: Jurisdiction; days: string; pattern: string; }
export function create(store: Store, input: NewRequest, now = new Date()): WfhRequest {
  store.seq += 1;
  const id = `WFH-2026-${String(store.seq).padStart(4, '0')}`;
  const r: WfhRequest = {
    id, employee: input.employee, role: input.role,
    roleKey: input.role.split('·')[0]!.trim().toLowerCase(),
    jurisdiction: input.jurisdiction, days: input.days, pattern: input.pattern,
    assessment: [], assessmentComplete: false, status: 'pending',
    consistency: { state: 'pending', rationale: 'Runs once the assessment is complete.' },
    audit: [stamp(now, 'Work-from-home notice submitted')],
  };
  return upsert(store, r);
}

export function assess(store: Store, id: string, factors: AssessmentFactor[], now = new Date()): WfhRequest {
  return upsert(store, completeAssessment(get(store, id), factors, store.priorDecisions, now));
}

export function distinguish(store: Store, id: string, factor: string, now = new Date()): WfhRequest {
  const r = get(store, id);
  const resolved = resolveByDistinguishing(r.consistency, factor);
  if (resolved === r.consistency) throw new GuardError('No active consistency flag to resolve.');
  return upsert(store, { ...r, consistency: resolved, audit: [...r.audit, stamp(now, 'Distinguishing factor recorded — refusal unlocked')] });
}

export function makeDecision(store: Store, id: string, type: DecisionType, ground: string, now = new Date()): WfhRequest {
  let r = get(store, id);
  if (type === 'approved' && r.consistency.state === 'flag') {
    r = { ...r, consistency: resolveByAlignment(r.consistency) };
  }
  const guard = canDecide(r, type);
  if (!guard.allowed) throw new GuardError(guard.reason ?? 'Decision blocked.');
  const decided = decide(r, type, ground, now);
  upsert(store, decided);
  if (type === 'approved' || type === 'modified') {
    store.priorDecisions.unshift({ id: decided.id, roleKey: decided.roleKey, jurisdiction: decided.jurisdiction, status: type, role: decided.role, days: decided.days });
  }
  return decided;
}

export function letter(store: Store, id: string): string { return renderDecisionLetter(get(store, id)); }
