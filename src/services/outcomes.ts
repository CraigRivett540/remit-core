import type { Store } from '../store/memory.js';
import type { Jurisdiction, Outcome, OutcomeContract } from '../domain/types.js';
import { deriveContractStatus, recordCycleReview } from '../domain/outcomes.js';
import { GuardError, NotFoundError } from './errors.js';

export function list(store: Store): OutcomeContract[] { return store.contracts; }

function parseContractSequence(id: string): number {
  const match = /^OC-\d{4}-Q\d-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function nextContractId(store: Store, now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  const next = store.contracts.reduce((max, contract) => Math.max(max, parseContractSequence(contract.id)), 0) + 1;
  return `OC-${year}-Q${quarter}-${String(next).padStart(3, '0')}`;
}

function getIndex(store: Store, id: string): number {
  const index = store.contracts.findIndex((contract) => contract.id === id);
  if (index < 0) throw new NotFoundError(`Contract ${id} not found`);
  return index;
}

export interface NewContract {
  employee: string;
  jurisdiction: Jurisdiction;
  period: string;
  signalSource: string;
  outcomes: Outcome[];
}

export interface ContractReviewInput {
  reviewerName: string;
  summary: string;
  signedOff: boolean;
}

export function create(store: Store, input: NewContract, now = new Date()): OutcomeContract {
  const contract: OutcomeContract = {
    id: nextContractId(store, now),
    employee: input.employee,
    jurisdiction: input.jurisdiction,
    period: input.period,
    outcomes: input.outcomes,
    signalSource: input.signalSource,
    status: deriveContractStatus(input.outcomes),
    cycleReviews: [],
    audit: [{ at: now.toISOString(), event: 'Outcome contract created' }],
  };
  store.contracts.unshift(contract);
  return contract;
}

export function updateOutcomes(store: Store, id: string, outcomes: Outcome[], now = new Date()): OutcomeContract {
  const index = getIndex(store, id);
  const current = store.contracts[index]!;
  if (current.status === 'reviewed') throw new GuardError('Outcome contract is finalised after review and cannot be edited.');
  const status = deriveContractStatus(outcomes);
  const delivered = outcomes.filter((outcome) => outcome.state === 'done').length;
  const updated: OutcomeContract = {
    ...current,
    outcomes,
    status,
    audit: [
      ...current.audit,
      { at: now.toISOString(), event: `Outcome states updated — ${delivered} of ${outcomes.length} delivered` },
    ],
  };
  store.contracts[index] = updated;
  return updated;
}

export function review(store: Store, id: string, input: ContractReviewInput, now = new Date()): OutcomeContract {
  const index = getIndex(store, id);
  const current = store.contracts[index]!;
  if (current.status === 'reviewed') throw new GuardError('Outcome cycle review already finalised.');
  const updated = recordCycleReview(current, input, now);
  store.contracts[index] = updated;
  return updated;
}
