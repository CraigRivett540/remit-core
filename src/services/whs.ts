import type { Store } from '../store/memory';
import type { Hazard } from '../domain/types';
import { validateControls, completeReview } from '../domain/hazards';
import { NotFoundError } from './errors';

function get(store: Store, id: string): Hazard {
  const h = store.hazards.find((x) => x.id === id);
  if (!h) throw new NotFoundError(`Hazard ${id} not found`);
  return h;
}
export function list(store: Store): Hazard[] { return store.hazards; }
export function validate(store: Store, id: string) { return validateControls(get(store, id)); }
export function review(store: Store, id: string, nextReviewDate: string, now = new Date()): Hazard {
  const updated = completeReview(get(store, id), nextReviewDate, now);
  const i = store.hazards.findIndex((x) => x.id === id);
  store.hazards[i] = updated;
  return updated;
}
