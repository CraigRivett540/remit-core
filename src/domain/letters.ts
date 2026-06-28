import type { WfhRequest } from './types.js';
import { JURISDICTION_PROFILES } from './jurisdictions.js';

/** Renders a decision-letter scaffold. COUNSEL: templates must be lawyer-approved before issue. */
export function renderDecisionLetter(request: WfhRequest): string {
  const d = request.decision;
  if (!d) throw new Error('No decision recorded on this request.');
  const p = JURISDICTION_PROFILES[request.jurisdiction];
  return [
    `[${d.letterTemplate}] — DRAFT · COUNSEL TO APPROVE`,
    ``,
    `Re: Flexible work arrangement — ${request.employee} (${request.role})`,
    `Jurisdiction: ${request.jurisdiction} · Framework: ${p.wfhFramework}`,
    ``,
    `Outcome: ${d.type.toUpperCase()}`,
    `Ground: ${d.ground}`,
    ``,
    `This decision followed a role-suitability assessment and a consistency review.`,
    `A full record is retained for 7 years (Fair Work Act 2009 (Cth) ss 535–536).`,
  ].join('\n');
}
