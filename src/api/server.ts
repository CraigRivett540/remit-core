import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as wfh from '../services/wfh.js';
import * as whs from '../services/whs.js';
import * as outcomes from '../services/outcomes.js';
import { AuthError, ForbiddenError, GuardError, NotFoundError, ValidationError } from '../services/errors.js';
import { buildGovernanceSummary } from '../services/reporting.js';
import { JURISDICTION_PROFILES } from '../domain/jurisdictions.js';
import { createStoreRuntime } from '../store/runtime.js';
import {
  asNonEmptyString,
  parseActorContext,
  parseContractOutcomesPayload,
  parseContractReviewPayload,
  parseHazardPatchPayload,
  parseNewContractPayload,
  parseNewHazardPayload,
  paginate,
  parseAssessmentPayload,
  parseDecisionPayload,
  parseDistinguishPayload,
  parseHazardReviewPayload,
  parseNewRequestPayload,
  parseOrgIdHeader,
  parsePagination,
  requireRole,
} from './validation.js';

const ok = (res: Response, data: unknown) => res.json({ data });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const runtime = await createStoreRuntime();
const store = runtime.store;

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const asyncRoute = (handler: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req, res, next).catch(next);
};

function requireOrgContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const orgId = parseOrgIdHeader(req);
    if (orgId !== runtime.orgId) throw new AuthError(`Unknown organisation context: ${orgId}`);
    next();
  } catch (error) {
    next(error);
  }
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  app.get('/api/health', (_req, res) => ok(res, {
    status: 'ok',
    org: store.org.name,
    orgId: runtime.orgId,
    backend: runtime.backend,
    strictBackend: runtime.strictBackend,
    backendFallbackReason: runtime.fallbackReason ?? null,
  }));
  app.get('/api/jurisdictions', (_req, res) => ok(res, JURISDICTION_PROFILES));

  app.use('/api/requests', requireOrgContext);
  app.use('/api/hazards', requireOrgContext);
  app.use('/api/contracts', requireOrgContext);
  app.use('/api/reports', requireOrgContext);

  app.get('/api/requests', (req, res) => {
    const { limit, offset } = parsePagination(req);
    ok(res, paginate(wfh.list(store), limit, offset));
  });
  app.post('/api/requests', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'ASSESSOR', 'MANAGER', 'DECISION_MAKER'], 'create work-from-home requests');
    const created = wfh.create(store, parseNewRequestPayload(req.body));
    await runtime.flush();
    ok(res, created);
  }));
  app.get('/api/requests/:id', (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    ok(res, wfh.get(store, id));
  });
  app.post('/api/requests/:id/assessment', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'ASSESSOR'], 'complete assessments');
    const id = asNonEmptyString(req.params.id, 'id');
    const updated = wfh.assess(store, id, parseAssessmentPayload(req.body));
    await runtime.flush();
    ok(res, updated);
  }));
  app.get('/api/reports/summary', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'ASSESSOR', 'DECISION_MAKER', 'WHS_LEAD', 'MANAGER', 'VIEWER'], 'view governance reports');
    ok(res, buildGovernanceSummary(store));
  }));
  app.post('/api/requests/:id/distinguish', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'DECISION_MAKER'], 'record distinguishing factors');
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseDistinguishPayload(req.body);
    const updated = wfh.distinguish(store, id, payload.factor);
    await runtime.flush();
    ok(res, updated);
  }));
  app.post('/api/requests/:id/decision', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'DECISION_MAKER'], 'record decisions');
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseDecisionPayload(req.body);
    const updated = wfh.makeDecision(store, id, payload.type, payload.ground);
    await runtime.flush();
    ok(res, updated);
  }));
  app.get('/api/requests/:id/letter', (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    ok(res, { letter: wfh.letter(store, id) });
  });

  app.get('/api/hazards', (req, res) => {
    const { limit, offset } = parsePagination(req);
    ok(res, paginate(whs.list(store), limit, offset));
  });
  app.post('/api/hazards', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'WHS_LEAD'], 'create hazard records');
    const created = whs.create(store, parseNewHazardPayload(req.body));
    await runtime.flush();
    ok(res, created);
  }));
  app.patch('/api/hazards/:id', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'WHS_LEAD'], 'update hazard records');
    const id = asNonEmptyString(req.params.id, 'id');
    const updated = whs.update(store, id, parseHazardPatchPayload(req.body));
    await runtime.flush();
    ok(res, updated);
  }));
  app.get('/api/hazards/:id/validation', (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    ok(res, whs.validate(store, id));
  });
  app.post('/api/hazards/:id/review', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'WHS_LEAD'], 'complete hazard reviews');
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseHazardReviewPayload(req.body);
    const updated = whs.review(store, id, payload);
    await runtime.flush();
    ok(res, updated);
  }));

  app.get('/api/contracts', (req, res) => {
    const { limit, offset } = parsePagination(req);
    ok(res, paginate(outcomes.list(store), limit, offset));
  });
  app.post('/api/contracts', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'MANAGER'], 'create outcome contracts');
    const created = outcomes.create(store, parseNewContractPayload(req.body));
    await runtime.flush();
    ok(res, created);
  }));
  app.patch('/api/contracts/:id/outcomes', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'MANAGER'], 'update outcome delivery states');
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseContractOutcomesPayload(req.body);
    const updated = outcomes.updateOutcomes(store, id, payload.outcomes);
    await runtime.flush();
    ok(res, updated);
  }));
  app.post('/api/contracts/:id/review', asyncRoute(async (req, res) => {
    const actor = parseActorContext(req);
    requireRole(actor, ['ADMIN', 'MANAGER'], 'record outcome cycle reviews');
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseContractReviewPayload(req.body);
    const updated = outcomes.review(store, id, payload);
    await runtime.flush();
    ok(res, updated);
  }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(422).json({ error: err.message });
    if (err instanceof AuthError || err instanceof ForbiddenError) {
      const status = err instanceof ForbiddenError || err.message.startsWith('Unknown organisation context') ? 403 : 401;
      return res.status(status).json({ error: err.message });
    }
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof GuardError) return res.status(409).json({ error: err.message });
    return res.status(400).json({ error: err.message });
  });

  return app;
}

const app = createApp();
export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`Remit API on http://localhost:${port}`));
}
