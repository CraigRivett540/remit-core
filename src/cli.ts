import { seedDemo } from './store/memory.js';
import * as wfh from './services/wfh.js';
import * as whs from './services/whs.js';
import * as outcomes from './services/outcomes.js';
import { GuardError } from './services/errors.js';

const line = (s = '') => console.log(s);
const rule = () => line('─'.repeat(64));
const now = new Date('2026-06-28T00:00:00Z');

const store = seedDemo();
const PASS = [
  { key: 'client', label: 'Client interaction', rating: 'green' as const, note: 'Low — virtual' },
  { key: 'whs', label: 'Home WHS assessment', rating: 'green' as const, note: 'Pass' },
];

line('\nREMIT — governance loop (reference run)'); rule();

// 1. New request for a role that has a comparable prior approval (Account Manager / VIC)
const r0 = wfh.create(store, { employee: 'Jordan Wells', role: 'Account Manager · Client Advisory', jurisdiction: 'VIC', days: '2 days', pattern: 'Mon & Tue' }, now);
line(`1. Created ${r0.id} — ${r0.employee} (${r0.role}, ${r0.jurisdiction})`);

// 2. Complete the assessment -> consistency check runs on real prior decisions
const r1 = wfh.assess(store, r0.id, PASS, now);
line(`2. Assessment complete -> consistency: ${r1.consistency.state.toUpperCase()}` + (r1.consistency.comparatorId ? ` vs ${r1.consistency.comparatorId}` : ''));

// 3. Try to refuse while flagged -> blocked by the guardrail
try { wfh.makeDecision(store, r0.id, 'refused', 'On-site preference', now); }
catch (e) { if (e instanceof GuardError) line(`3. Refuse attempt BLOCKED -> ${e.message}`); else throw e; }

// 4. Resolve by aligning + approve, then show the letter template + prior-decision update
const r2 = wfh.makeDecision(store, r0.id, 'approved', 'Consistent with comparable approval', now);
line(`4. Approved (aligned) -> letter ${r2.decision?.letterTemplate}; prior decisions now ${store.priorDecisions.length}`);
rule();
line(wfh.letter(store, r0.id)); rule();

// 5. WHS — validate controls + complete the due review
const v = whs.validate(store, 'HZ-024');
line(`5. Hazard HZ-024 controls valid: ${v.valid}${v.warnings.length ? ` (warnings: ${v.warnings.length})` : ''}`);
const h = whs.review(store, 'HZ-024', '2026-12-20', now);
line(`   Review completed -> status ${h.status}, next ${h.reviewDate}, audit events ${h.audit.length}`);

// 6. Outcomes — record a cycle review
const c = outcomes.review(store, 'OC-2026-Q3-014', now);
line(`6. Outcome cycle review recorded -> status ${c.status}; "${c.audit[c.audit.length - 2]?.event}"`);
rule(); line('Done — every step above is enforced by src/domain (pure) + src/services.\n');
