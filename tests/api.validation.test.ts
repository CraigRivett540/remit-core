import { describe, expect, test } from 'vitest';
import {
  paginate,
  parseActorContext,
  parseContractReviewPayload,
  parseDecisionPayload,
  parseNewContractPayload,
  parseNewHazardPayload,
  parseNewRequestPayload,
  parsePagination,
  requireRole,
} from '../src/api/validation.js';
import { AuthError, ForbiddenError, ValidationError } from '../src/services/errors.js';

describe('api validation', () => {
  test('pagination defaults are applied', () => {
    const page = parsePagination({ query: {} } as never);
    expect(page).toEqual({ limit: 10, offset: 0 });
  });

  test('invalid limit throws ValidationError', () => {
    expect(() => parsePagination({ query: { limit: '0', offset: '0' } } as never))
      .toThrow(ValidationError);
  });

  test('new request payload parses valid body', () => {
    const payload = parseNewRequestPayload({
      employee: 'Jordan Wells',
      role: 'Account Manager',
      jurisdiction: 'VIC',
      days: '2 days',
      pattern: 'Mon & Tue',
      staffRecordType: 'existing',
      previousArrangement: '2 days · Tue & Thu',
      previousArrangementSince: '2025-02-01',
      previousArrangementNotes: 'Arrangement entered from staff master record.',
    });
    expect(payload.employee).toBe('Jordan Wells');
    expect(payload.jurisdiction).toBe('VIC');
    expect(payload.staffRecordType).toBe('existing');
    expect(payload.previousArrangementSince).toBe('2025-02-01');
  });

  test('new request payload rejects invalid jurisdiction', () => {
    expect(() => parseNewRequestPayload({
      employee: 'Jordan Wells',
      role: 'Account Manager',
      jurisdiction: 'NZ',
      days: '2 days',
      pattern: 'Mon & Tue',
    })).toThrow(ValidationError);
  });

  test('new request payload rejects invalid staff record type', () => {
    expect(() => parseNewRequestPayload({
      employee: 'Jordan Wells',
      role: 'Account Manager',
      jurisdiction: 'VIC',
      days: '2 days',
      pattern: 'Mon & Tue',
      staffRecordType: 'contractor',
    })).toThrow(ValidationError);
  });

  test('decision payload validates allowed type', () => {
    expect(parseDecisionPayload({ type: 'approved', ground: 'Consistent with comparator' }).type)
      .toBe('approved');
    expect(() => parseDecisionPayload({ type: 'escalated', ground: 'n/a' })).toThrow(ValidationError);
  });

  test('paginate returns metadata and sliced items', () => {
    const result = paginate([1, 2, 3, 4], 2, 2);
    expect(result.items).toEqual([3, 4]);
    expect(result.page.total).toBe(4);
    expect(result.page.hasPrev).toBe(true);
    expect(result.page.hasNext).toBe(false);
  });

  test('actor context parsing validates auth headers and role', () => {
    const req = {
      header: (name: string) => {
        if (name === 'x-user-id') return 'user-1';
        if (name === 'x-user-role') return 'ADMIN';
        return undefined;
      },
    } as never;
    const actor = parseActorContext(req);
    expect(actor).toEqual({ userId: 'user-1', role: 'ADMIN' });
    expect(() => parseActorContext({ header: () => undefined } as never)).toThrow(AuthError);
  });

  test('requireRole denies disallowed actor role', () => {
    expect(() => requireRole({ userId: 'u', role: 'VIEWER' }, ['ADMIN'], 'mutate records')).toThrow(ForbiddenError);
  });

  test('hazard payload parses controls and review date', () => {
    const payload = parseNewHazardPayload({
      name: 'Workload spike',
      type: 'psychosocial',
      jurisdiction: 'NSW',
      controls: [{ tier: 'higher', text: 'Work redesign', primary: true }],
      consultation: 'Workers consulted',
      triggers: ['Scheduled — 2026-09-01'],
      reviewDate: '2026-09-01',
    });
    expect(payload.controls[0]?.tier).toBe('higher');
    expect(payload.reviewDate).toBe('2026-09-01');
  });

  test('contract payload and review payload validate expected fields', () => {
    const contractPayload = parseNewContractPayload({
      employee: 'Jordan Wells',
      jurisdiction: 'VIC',
      period: 'Q3 2026',
      signalSource: 'CRM',
      outcomes: [{ text: 'Deliver proposal', state: 'progress' }],
    });
    expect(contractPayload.outcomes.length).toBe(1);
    const reviewPayload = parseContractReviewPayload({});
    expect(reviewPayload.signedOff).toBe(true);
  });
});
