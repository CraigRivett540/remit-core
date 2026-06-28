import { describe, expect, test } from 'vitest';
import {
  paginate,
  parseDecisionPayload,
  parseNewRequestPayload,
  parsePagination,
} from '../src/api/validation.js';
import { ValidationError } from '../src/services/errors.js';

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
    });
    expect(payload.employee).toBe('Jordan Wells');
    expect(payload.jurisdiction).toBe('VIC');
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
});
