import type { AuditEvent } from './types.js';
export function stamp(now: Date, event: string): AuditEvent {
  return { at: now.toISOString(), event };
}
