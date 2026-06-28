import type { Request } from 'express';
import type { AssessmentFactor, Control, DecisionType, HazardType, Jurisdiction, Outcome, OutcomeState } from '../domain/types.js';
import { ValidationError, AuthError, ForbiddenError } from '../services/errors.js';

const JURISDICTIONS: Jurisdiction[] = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const DECISION_TYPES: DecisionType[] = ['approved', 'modified', 'refused'];
const RATINGS: AssessmentFactor['rating'][] = ['green', 'amber', 'red'];
const HAZARD_TYPES: HazardType[] = ['psychosocial', 'physical'];
const CONTROL_TIERS: Control['tier'][] = ['higher', 'lower'];
const OUTCOME_STATES: OutcomeState[] = ['done', 'progress', 'notstarted'];
const ACTOR_ROLES = ['ADMIN', 'ASSESSOR', 'DECISION_MAKER', 'WHS_LEAD', 'MANAGER', 'VIEWER'] as const;

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
export type ActorRole = typeof ACTOR_ROLES[number];
export interface ActorContext {
  userId: string;
  role: ActorRole;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError(message);
  return value as Record<string, unknown>;
}
function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') throw new ValidationError(`${fieldName} must be a boolean.`);
  return value;
}

function parseDate(value: string, fieldName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${fieldName} must be in YYYY-MM-DD format.`);
  }
  return value;
}

export function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') throw new ValidationError(`${fieldName} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${fieldName} cannot be empty.`);
  return trimmed;
}

export function parsePagination(req: Request) {
  const rawLimit = req.query.limit;
  const rawOffset = req.query.offset;
  const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
  const offset = rawOffset === undefined ? 0 : Number(rawOffset);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError('offset must be a non-negative integer.');
  }

  return { limit, offset };
}

export function paginate<T>(items: readonly T[], limit: number, offset: number) {
  const pageItems = items.slice(offset, offset + limit);
  const total = items.length;
  return {
    items: pageItems,
    page: {
      limit,
      offset,
      total,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    },
  };
}

export function parseOrgIdHeader(req: Request): string {
  const value = req.header('x-org-id');
  if (!value) throw new AuthError('Missing x-org-id header.');
  return asNonEmptyString(value, 'x-org-id');
}

export function parseActorContext(req: Request): ActorContext {
  const userId = req.header('x-user-id');
  const roleRaw = req.header('x-user-role');
  if (!userId) throw new AuthError('Missing x-user-id header.');
  if (!roleRaw) throw new AuthError('Missing x-user-role header.');
  const role = asNonEmptyString(roleRaw, 'x-user-role').toUpperCase() as ActorRole;
  if (!ACTOR_ROLES.includes(role)) {
    throw new AuthError(`x-user-role must be one of: ${ACTOR_ROLES.join(', ')}`);
  }
  return {
    userId: asNonEmptyString(userId, 'x-user-id'),
    role,
  };
}

export function requireRole(actor: ActorContext, allowedRoles: readonly ActorRole[], action: string): void {
  if (!allowedRoles.includes(actor.role)) {
    throw new ForbiddenError(`Role ${actor.role} is not permitted to ${action}.`);
  }
}

export function parseNewRequestPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const jurisdiction = asNonEmptyString(payload.jurisdiction, 'jurisdiction') as Jurisdiction;
  if (!JURISDICTIONS.includes(jurisdiction)) {
    throw new ValidationError(`jurisdiction must be one of: ${JURISDICTIONS.join(', ')}`);
  }
  return {
    employee: asNonEmptyString(payload.employee, 'employee'),
    role: asNonEmptyString(payload.role, 'role'),
    jurisdiction,
    days: asNonEmptyString(payload.days, 'days'),
    pattern: asNonEmptyString(payload.pattern, 'pattern'),
  };
}

export function parseAssessmentPayload(body: unknown): AssessmentFactor[] {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  if (!Array.isArray(payload.factors)) {
    throw new ValidationError('factors must be an array.');
  }
  return payload.factors.map((factor, index) => {
    const item = asRecord(factor, `factors[${index}] must be an object.`);
    const rating = asNonEmptyString(item.rating, `factors[${index}].rating`) as AssessmentFactor['rating'];
    if (!RATINGS.includes(rating)) {
      throw new ValidationError(`factors[${index}].rating must be one of: ${RATINGS.join(', ')}`);
    }
    return {
      key: asNonEmptyString(item.key, `factors[${index}].key`),
      label: asNonEmptyString(item.label, `factors[${index}].label`),
      rating,
      note: asNonEmptyString(item.note, `factors[${index}].note`),
    };
  });
}

export function parseDistinguishPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  return { factor: asNonEmptyString(payload.factor, 'factor') };
}

export function parseDecisionPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const type = asNonEmptyString(payload.type, 'type') as DecisionType;
  if (!DECISION_TYPES.includes(type)) {
    throw new ValidationError(`type must be one of: ${DECISION_TYPES.join(', ')}`);
  }
  return {
    type,
    ground: asNonEmptyString(payload.ground, 'ground'),
  };
}

export function parseHazardReviewPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const nextReviewDate = parseDate(asNonEmptyString(payload.nextReviewDate, 'nextReviewDate'), 'nextReviewDate');
  const finding = asOptionalString(payload.finding) ?? 'Controls confirmed effective';
  const reviewer = asOptionalString(payload.reviewer) ?? 'System WHS Reviewer';
  return { nextReviewDate, finding, reviewer };
}

function parseControls(value: unknown, fieldName: string): Control[] {
  if (!Array.isArray(value)) throw new ValidationError(`${fieldName} must be an array.`);
  const controls = value.map((entry, index) => {
    const control = asRecord(entry, `${fieldName}[${index}] must be an object.`);
    const tier = asNonEmptyString(control.tier, `${fieldName}[${index}].tier`) as Control['tier'];
    if (!CONTROL_TIERS.includes(tier)) {
      throw new ValidationError(`${fieldName}[${index}].tier must be one of: ${CONTROL_TIERS.join(', ')}`);
    }
    return {
      tier,
      text: asNonEmptyString(control.text, `${fieldName}[${index}].text`),
      primary: control.primary === undefined ? undefined : asBoolean(control.primary, `${fieldName}[${index}].primary`),
    };
  });
  if (!controls.length) throw new ValidationError(`${fieldName} must include at least one control.`);
  return controls;
}

function parseStringList(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) throw new ValidationError(`${fieldName} must be an array.`);
  return value.map((item, index) => asNonEmptyString(item, `${fieldName}[${index}]`));
}

function parseOutcomes(value: unknown, fieldName: string): Outcome[] {
  if (!Array.isArray(value)) throw new ValidationError(`${fieldName} must be an array.`);
  const outcomes = value.map((entry, index) => {
    const outcome = asRecord(entry, `${fieldName}[${index}] must be an object.`);
    const state = asNonEmptyString(outcome.state, `${fieldName}[${index}].state`) as OutcomeState;
    if (!OUTCOME_STATES.includes(state)) {
      throw new ValidationError(`${fieldName}[${index}].state must be one of: ${OUTCOME_STATES.join(', ')}`);
    }
    return {
      text: asNonEmptyString(outcome.text, `${fieldName}[${index}].text`),
      state,
    };
  });
  if (!outcomes.length) throw new ValidationError(`${fieldName} must include at least one outcome item.`);
  return outcomes;
}

export function parseNewHazardPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const jurisdiction = asNonEmptyString(payload.jurisdiction, 'jurisdiction') as Jurisdiction;
  if (!JURISDICTIONS.includes(jurisdiction)) {
    throw new ValidationError(`jurisdiction must be one of: ${JURISDICTIONS.join(', ')}`);
  }
  const type = asNonEmptyString(payload.type, 'type') as HazardType;
  if (!HAZARD_TYPES.includes(type)) {
    throw new ValidationError(`type must be one of: ${HAZARD_TYPES.join(', ')}`);
  }
  return {
    name: asNonEmptyString(payload.name, 'name'),
    type,
    jurisdiction,
    controls: parseControls(payload.controls, 'controls'),
    consultation: asOptionalString(payload.consultation) ?? 'Consultation record pending.',
    triggers: payload.triggers === undefined ? [] : parseStringList(payload.triggers, 'triggers'),
    reviewDate: parseDate(asNonEmptyString(payload.reviewDate, 'reviewDate'), 'reviewDate'),
  };
}

export function parseHazardPatchPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const patch: {
    controls?: Control[];
    consultation?: string;
    triggers?: string[];
    reviewDate?: string;
  } = {};
  if (payload.controls !== undefined) patch.controls = parseControls(payload.controls, 'controls');
  if (payload.consultation !== undefined) patch.consultation = asNonEmptyString(payload.consultation, 'consultation');
  if (payload.triggers !== undefined) patch.triggers = parseStringList(payload.triggers, 'triggers');
  if (payload.reviewDate !== undefined) patch.reviewDate = parseDate(asNonEmptyString(payload.reviewDate, 'reviewDate'), 'reviewDate');
  if (!Object.keys(patch).length) throw new ValidationError('At least one updatable hazard field is required.');
  return patch;
}

export function parseNewContractPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const jurisdiction = asNonEmptyString(payload.jurisdiction, 'jurisdiction') as Jurisdiction;
  if (!JURISDICTIONS.includes(jurisdiction)) {
    throw new ValidationError(`jurisdiction must be one of: ${JURISDICTIONS.join(', ')}`);
  }
  return {
    employee: asNonEmptyString(payload.employee, 'employee'),
    jurisdiction,
    period: asNonEmptyString(payload.period, 'period'),
    signalSource: asNonEmptyString(payload.signalSource, 'signalSource'),
    outcomes: parseOutcomes(payload.outcomes, 'outcomes'),
  };
}

export function parseContractOutcomesPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  return {
    outcomes: parseOutcomes(payload.outcomes, 'outcomes'),
  };
}

export function parseContractReviewPayload(body: unknown) {
  const payload = asRecord(body, 'Request body must be a JSON object.');
  const reviewerName = asOptionalString(payload.reviewerName) ?? 'System Manager';
  const summary = asOptionalString(payload.summary) ?? 'Cycle review recorded against delivery signals.';
  const signedOff = payload.signedOff === undefined ? true : asBoolean(payload.signedOff, 'signedOff');
  return { reviewerName, summary, signedOff };
}
