import type { ContractStatus, Outcome, OutcomeContract } from './types.js';
import { stamp } from './audit.js';

// Outcome contracts read DELIVERY STATE only (from existing tools). Never keystrokes,
// screenshots or activity. Performance records support a defensible, procedurally fair process
// (Fair Work Act 2009 (Cth) Pt 3-1 & Pt 3-2) and are a higher-order psychosocial control.
export function deriveContractStatus(outcomes: readonly Outcome[]): ContractStatus {
  if (!outcomes.length) return 'review';
  const hasNotStarted = outcomes.some((outcome) => outcome.state === 'notstarted');
  return hasNotStarted ? 'review' : 'ontrack';
}

export interface CycleReviewInput {
  reviewerName: string;
  summary: string;
  signedOff: boolean;
}

export function recordCycleReview(
  contract: OutcomeContract,
  input: CycleReviewInput,
  now: Date = new Date(),
): OutcomeContract {
  const done = contract.outcomes.filter((o) => o.state === 'done').length;
  const reviewRecord = {
    reviewerName: input.reviewerName,
    summary: input.summary,
    signedOff: input.signedOff,
    reviewedAt: now.toISOString(),
  };
  return {
    ...contract,
    status: 'reviewed',
    cycleReviews: [...contract.cycleReviews, reviewRecord],
    audit: [
      ...contract.audit,
      stamp(now, `${contract.period} cycle review recorded — ${done} of ${contract.outcomes.length} outcomes delivered`),
      stamp(now, `${input.reviewerName} recorded review — ${input.summary}`),
      stamp(now, input.signedOff ? 'Reviewed and signed off; record retained' : 'Reviewed; sign-off pending'),
    ],
  };
}
