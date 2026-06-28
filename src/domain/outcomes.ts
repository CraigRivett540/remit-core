import type { OutcomeContract } from './types';
import { stamp } from './audit';

// Outcome contracts read DELIVERY STATE only (from existing tools). Never keystrokes,
// screenshots or activity. Performance records support a defensible, procedurally fair process
// (Fair Work Act 2009 (Cth) Pt 3-1 & Pt 3-2) and are a higher-order psychosocial control.
export function recordCycleReview(contract: OutcomeContract, now: Date = new Date()): OutcomeContract {
  const done = contract.outcomes.filter((o) => o.state === 'done').length;
  return {
    ...contract,
    status: 'reviewed',
    audit: [
      ...contract.audit,
      stamp(now, `${contract.period} cycle review recorded — ${done} of ${contract.outcomes.length} outcomes delivered`),
      stamp(now, 'Reviewed and signed off; record retained'),
    ],
  };
}
