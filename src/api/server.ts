import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as wfh from '../services/wfh.js';
import * as whs from '../services/whs.js';
import * as outcomes from '../services/outcomes.js';
import { AuthError, GuardError, NotFoundError, ValidationError } from '../services/errors.js';
import { JURISDICTION_PROFILES } from '../domain/jurisdictions.js';
import { createStoreRuntime } from '../store/runtime.js';
import {
  asNonEmptyString,
  paginate,
  parseAssessmentPayload,
  parseDecisionPayload,
  parseDistinguishPayload,
  parseHazardReviewPayload,
  parseNewRequestPayload,
  parseOrgIdHeader,
  parsePagination,
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
  }));
  app.get('/api/jurisdictions', (_req, res) => ok(res, JURISDICTION_PROFILES));

  app.use('/api/requests', requireOrgContext);
  app.use('/api/hazards', requireOrgContext);
  app.use('/api/contracts', requireOrgContext);

  app.get('/api/requests', (req, res) => {
    const { limit, offset } = parsePagination(req);
    ok(res, paginate(wfh.list(store), limit, offset));
  });
  app.post('/api/requests', asyncRoute(async (req, res) => {
    const created = wfh.create(store, parseNewRequestPayload(req.body));
    await runtime.flush();
    ok(res, created);
  }));
  app.get('/api/requests/:id', (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    ok(res, wfh.get(store, id));
  });
  app.post('/api/requests/:id/assessment', asyncRoute(async (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    const updated = wfh.assess(store, id, parseAssessmentPayload(req.body));
    await runtime.flush();
    ok(res, updated);
  }));
  app.post('/api/requests/:id/distinguish', asyncRoute(async (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseDistinguishPayload(req.body);
    const updated = wfh.distinguish(store, id, payload.factor);
    await runtime.flush();
    ok(res, updated);
  }));
  app.post('/api/requests/:id/decision', asyncRoute(async (req, res) => {
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
  app.get('/api/hazards/:id/validation', (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    ok(res, whs.validate(store, id));
  });
  app.post('/api/hazards/:id/review', asyncRoute(async (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    const payload = parseHazardReviewPayload(req.body);
    const updated = whs.review(store, id, payload.nextReviewDate);
    await runtime.flush();
    ok(res, updated);
  }));

  app.get('/api/contracts', (req, res) => {
    const { limit, offset } = parsePagination(req);
    ok(res, paginate(outcomes.list(store), limit, offset));
  });
  app.post('/api/contracts/:id/review', asyncRoute(async (req, res) => {
    const id = asNonEmptyString(req.params.id, 'id');
    const updated = outcomes.review(store, id);
    await runtime.flush();
    ok(res, updated);
  }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(422).json({ error: err.message });
    if (err instanceof AuthError) {
      const status = err.message.startsWith('Unknown organisation context') ? 403 : 401;
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
