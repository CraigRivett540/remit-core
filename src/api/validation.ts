import type { Request } from 'express';
import type { AssessmentFactor, DecisionType, Jurisdiction } from '../domain/types.js';
import { ValidationError, AuthError } from '../services/errors.js';

const JURISDICTIONS: Jurisdiction[] = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const DECISION_TYPES: DecisionType[] = ['approved', 'modified', 'refused'];
const RATINGS: AssessmentFactor['rating'][] = ['green', 'amber', 'red'];

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError(message);
  return value as Record<string, unknown>;
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
  const nextReviewDate = asNonEmptyString(payload.nextReviewDate, 'nextReviewDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextReviewDate)) {
    throw new ValidationError('nextReviewDate must be in YYYY-MM-DD format.');
  }
  return { nextReviewDate };
}
