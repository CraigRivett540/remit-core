import type { WfhRequest, PriorDecision, Hazard, OutcomeContract } from '../src/domain/types.js';

export const PRIOR: PriorDecision[] = [
  { id: 'WFH-2026-0129', roleKey: 'account manager', jurisdiction: 'VIC', status: 'approved', days: '2 days', date: '2 Jun 2026' },
  { id: 'WFH-2026-0124', roleKey: 'analyst', jurisdiction: 'QLD', status: 'approved', days: '2 days', date: '22 May 2026' },
];

export const request = (over: Partial<WfhRequest> = {}): WfhRequest => ({
  id: 'WFH-2026-0142',
  employee: 'Sofia Marchetti',
  roleKey: 'account manager',
  role: 'Account Manager · Client Advisory',
  jurisdiction: 'VIC',
  days: '2 days',
  pattern: 'Mon & Tue',
  assessment: [],
  assessmentComplete: true,
  status: 'pending',
  consistency: { state: 'pending', rationale: '' },
  audit: [],
  ...over,
});

export const hazard = (over: Partial<Hazard> = {}): Hazard => ({
  id: 'HZ-019',
  name: 'Isolation — small remote teams',
  type: 'psychosocial',
  jurisdiction: 'VIC',
  controls: [{ tier: 'higher', text: 'Structured fortnightly check-ins', primary: true }],
  consultation: 'HSR consulted',
  triggers: ['Scheduled review'],
  status: 'ontrack',
  reviewDate: '2026-08-12',
  reviews: [],
  audit: [],
  ...over,
});

export const contract = (over: Partial<OutcomeContract> = {}): OutcomeContract => ({
  id: 'OC-2026-Q3-014',
  employee: 'Sofia Marchetti',
  jurisdiction: 'VIC',
  period: 'Q3 2026',
  outcomes: [
    { text: 'Renew three lapsed accounts', state: 'done' },
    { text: 'Onboard two new clients', state: 'done' },
    { text: 'FY27 account plan', state: 'notstarted' },
  ],
  signalSource: 'CRM',
  status: 'ontrack',
  cycleReviews: [],
  audit: [],
  ...over,
});

export const FIXED = new Date('2026-06-27T00:00:00Z');
