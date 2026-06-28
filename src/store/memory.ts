import type { WfhRequest, PriorDecision, Hazard, OutcomeContract, Jurisdiction } from '../domain/types';

// Org-scoped in-memory store for the reference app. Swap for the Prisma repositories (M2)
// without touching the domain core or services.
export interface Store {
  org: { id: string; name: string; jurisdictions: Jurisdiction[] };
  seq: number;
  requests: WfhRequest[];
  priorDecisions: PriorDecision[];
  hazards: Hazard[];
  contracts: OutcomeContract[];
}

export function seed(): Store {
  return {
    org: { id: 'org_brightwater', name: 'Brightwater Group', jurisdictions: ['VIC', 'NSW', 'QLD', 'WA'] },
    seq: 142,
    requests: [
      {
        id: 'WFH-2026-0139', employee: 'Hamish Reid', roleKey: 'analyst', role: 'Analyst · Research',
        jurisdiction: 'QLD', days: '2 days', pattern: 'Tue & Thu', assessment: [], assessmentComplete: false,
        status: 'pending', consistency: { state: 'pending', rationale: 'Runs once the assessment is complete.' },
        audit: [{ at: '2026-06-25T06:22:00.000Z', event: 'Work-from-home notice submitted' }],
      },
    ],
    priorDecisions: [
      { id: 'WFH-2026-0129', roleKey: 'account manager', jurisdiction: 'VIC', status: 'approved', role: 'Account Manager', days: '2 days', date: '2 Jun 2026' },
      { id: 'WFH-2026-0124', roleKey: 'analyst', jurisdiction: 'QLD', status: 'approved', role: 'Analyst', days: '2 days', date: '22 May 2026' },
    ],
    hazards: [
      {
        id: 'HZ-024', name: 'High workload — Q3 reporting', type: 'psychosocial', jurisdiction: 'NSW',
        controls: [
          { tier: 'higher', text: 'Workload redistributed; deadlines staggered', primary: true },
          { tier: 'lower', text: 'Manager check-in script (supplement only)' },
        ],
        consultation: 'Workers + HSR consulted', triggers: ['Scheduled — 30 Jun 2026'],
        status: 'due', reviewDate: '2026-06-30',
        audit: [{ at: '2026-05-16T00:00:00.000Z', event: 'Workload redistribution applied; consulted' }],
      },
    ],
    contracts: [
      {
        id: 'OC-2026-Q3-014', employee: 'Sofia Marchetti', jurisdiction: 'VIC', period: 'Q3 2026',
        outcomes: [
          { text: 'Renew three lapsed accounts', state: 'done' },
          { text: 'Onboard two new clients', state: 'done' },
          { text: 'FY27 account plan', state: 'notstarted' },
        ],
        signalSource: 'CRM', status: 'ontrack',
        audit: [{ at: '2026-07-01T00:00:00.000Z', event: 'Outcomes co-set and agreed' }],
      },
    ],
  };
}
