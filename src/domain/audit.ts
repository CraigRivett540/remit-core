import type { AuditEvent } from './types';
export function stamp(now: Date, event: string): AuditEvent {
  return { at: now.toISOString(), event };
}
