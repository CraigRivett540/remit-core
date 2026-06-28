import type { Store } from '../store/memory.js';

interface AuditLine {
  at: string;
  event: string;
  source: 'request' | 'hazard' | 'contract';
  id: string;
}

function toMillis(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function buildGovernanceSummary(store: Store) {
  const requestCounts = {
    total: store.requests.length,
    pending: store.requests.filter((request) => request.status === 'pending').length,
    flagged: store.requests.filter((request) => request.status === 'flagged').length,
    approved: store.requests.filter((request) => request.status === 'approved').length,
    modified: store.requests.filter((request) => request.status === 'modified').length,
    refused: store.requests.filter((request) => request.status === 'refused').length,
  };

  const hazardCounts = {
    total: store.hazards.length,
    ontrack: store.hazards.filter((hazard) => hazard.status === 'ontrack').length,
    due: store.hazards.filter((hazard) => hazard.status === 'due').length,
    reviewed: store.hazards.filter((hazard) => hazard.status === 'reviewed').length,
  };

  const outcomeCounts = {
    total: store.contracts.length,
    ontrack: store.contracts.filter((contract) => contract.status === 'ontrack').length,
    review: store.contracts.filter((contract) => contract.status === 'review').length,
    reviewed: store.contracts.filter((contract) => contract.status === 'reviewed').length,
  };

  const delivery = store.contracts.reduce((acc, contract) => {
    acc.total += contract.outcomes.length;
    acc.done += contract.outcomes.filter((outcome) => outcome.state === 'done').length;
    return acc;
  }, { total: 0, done: 0 });

  const recentAudit: AuditLine[] = [
    ...store.requests.flatMap((request) => request.audit.map((audit) => ({ ...audit, source: 'request' as const, id: request.id }))),
    ...store.hazards.flatMap((hazard) => hazard.audit.map((audit) => ({ ...audit, source: 'hazard' as const, id: hazard.id }))),
    ...store.contracts.flatMap((contract) => contract.audit.map((audit) => ({ ...audit, source: 'contract' as const, id: contract.id }))),
  ]
    .sort((left, right) => toMillis(right.at) - toMillis(left.at))
    .slice(0, 10);

  return {
    requests: requestCounts,
    hazards: hazardCounts,
    outcomes: {
      ...outcomeCounts,
      delivered: delivery.done,
      totalItems: delivery.total,
    },
    unresolvedFlags: requestCounts.flagged,
    dueHazardReviews: hazardCounts.due,
    recentAudit,
  };
}
