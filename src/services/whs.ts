import type { Store } from '../store/memory.js';
import type { Control, Hazard, HazardType, Jurisdiction } from '../domain/types.js';
import { validateControls, completeReview } from '../domain/hazards.js';
import { GuardError, NotFoundError } from './errors.js';

function get(store: Store, id: string): Hazard {
  const h = store.hazards.find((x) => x.id === id);
  if (!h) throw new NotFoundError(`Hazard ${id} not found`);
  return h;
}

function parseHazardSequence(id: string): number {
  const match = /^HZ-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function nextHazardId(store: Store): string {
  const next = store.hazards.reduce((max, hazard) => Math.max(max, parseHazardSequence(hazard.id)), 0) + 1;
  return `HZ-${String(next).padStart(3, '0')}`;
}

function upsert(store: Store, hazard: Hazard): Hazard {
  const index = store.hazards.findIndex((item) => item.id === hazard.id);
  if (index >= 0) store.hazards[index] = hazard;
  else store.hazards.unshift(hazard);
  return hazard;
}
export function list(store: Store): Hazard[] { return store.hazards; }
export function validate(store: Store, id: string) { return validateControls(get(store, id)); }

export interface NewHazard {
  name: string;
  type: HazardType;
  jurisdiction: Jurisdiction;
  controls: Control[];
  consultation: string;
  triggers: string[];
  reviewDate: string;
}

export interface HazardPatch {
  controls?: Control[];
  consultation?: string;
  triggers?: string[];
  reviewDate?: string;
}

export interface HazardReviewInput {
  nextReviewDate: string;
  finding: string;
  reviewer: string;
}

export function create(store: Store, input: NewHazard, now = new Date()): Hazard {
  const hazard: Hazard = {
    id: nextHazardId(store),
    name: input.name,
    type: input.type,
    jurisdiction: input.jurisdiction,
    controls: input.controls,
    consultation: input.consultation,
    triggers: input.triggers,
    status: 'ontrack',
    reviewDate: input.reviewDate,
    reviews: [],
    audit: [{ at: now.toISOString(), event: 'Hazard record created' }],
  };
  return upsert(store, hazard);
}

export function update(store: Store, id: string, patch: HazardPatch, now = new Date()): Hazard {
  const current = get(store, id);
  if (current.status === 'reviewed') throw new GuardError('Hazard record is finalised after review and cannot be edited.');
  const updated: Hazard = {
    ...current,
    controls: patch.controls ?? current.controls,
    consultation: patch.consultation ?? current.consultation,
    triggers: patch.triggers ?? current.triggers,
    reviewDate: patch.reviewDate ?? current.reviewDate,
    audit: [...current.audit, { at: now.toISOString(), event: 'Hazard record updated' }],
  };
  return upsert(store, updated);
}

export function review(store: Store, id: string, input: HazardReviewInput, now = new Date()): Hazard {
  const current = get(store, id);
  if (current.status === 'reviewed') throw new GuardError('Hazard review already finalised.');
  const validation = validateControls(current);
  if (!validation.valid) {
    throw new GuardError(`Cannot complete review while control validation has issues: ${validation.issues.join(' ')}`);
  }
  const updated = completeReview(current, input.nextReviewDate, input.finding, input.reviewer, now);
  return upsert(store, updated);
}
