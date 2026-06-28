import type { Hazard } from './types.js';
import { JURISDICTION_PROFILES } from './jurisdictions.js';
import { stamp } from './audit.js';

export interface ControlValidation { valid: boolean; issues: string[]; warnings: string[]; }

/**
 * Hierarchy-of-controls guardrail.
 * Where a jurisdiction applies a modified control hierarchy for psychosocial hazards
 * (e.g. VIC under the OHS (Psychological Health) Regulations 2025), training/information
 * (lower-order) cannot be the sole or predominant control — at least one higher-order
 * control is required and must be designated primary.
 * COUNSEL: verify per-jurisdiction before production reliance.
 */
export function validateControls(hazard: Hazard): ControlValidation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const higher = hazard.controls.filter((c) => c.tier === 'higher');
  const lower = hazard.controls.filter((c) => c.tier === 'lower');

  if (hazard.controls.length === 0) issues.push('No controls recorded.');

  const profile = JURISDICTION_PROFILES[hazard.jurisdiction];
  if (hazard.type === 'psychosocial' && profile.modifiedControlHierarchy) {
    if (higher.length === 0) {
      issues.push('Modified hierarchy: at least one higher-order control is required — training/information cannot be the sole control.');
    } else if (!higher.some((c) => c.primary)) {
      issues.push('Modified hierarchy: a higher-order control must be designated the primary control.');
    }
  } else if (higher.length === 0 && lower.length > 0) {
    warnings.push('Lower-order controls alone are weak — consider a higher-order control.');
  }

  return { valid: issues.length === 0, issues, warnings };
}

export function completeReview(
  hazard: Hazard,
  nextReviewDate: string,
  finding: string,
  reviewer: string,
  now: Date = new Date(),
): Hazard {
  return {
    ...hazard,
    status: 'reviewed',
    reviewDate: nextReviewDate,
    reviews: [
      ...hazard.reviews,
      {
        at: now.toISOString(),
        reviewer,
        finding,
        nextReviewDate,
      },
    ],
    audit: [
      ...hazard.audit,
      stamp(now, `Control review completed — ${finding}`),
      stamp(now, `Reviewed by ${reviewer}; next review scheduled ${nextReviewDate}`),
    ],
  };
}
