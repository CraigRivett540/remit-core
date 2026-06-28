import type { Store } from '../store/memory';
import type { OutcomeContract } from '../domain/types';
import { recordCycleReview } from '../domain/outcomes';
import { NotFoundError } from './errors';

export function list(store: Store): OutcomeContract[] { return store.contracts; }
export function review(store: Store, id: string, now = new Date()): OutcomeContract {
  const i = store.contracts.findIndex((x) => x.id === id);
  if (i < 0) throw new NotFoundError(`Contract ${id} not found`);
  const updated = recordCycleReview(store.contracts[i]!, now);
  store.contracts[i] = updated;
  return updated;
}
