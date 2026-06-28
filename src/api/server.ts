import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from '../store/memory';
import * as wfh from '../services/wfh';
import * as whs from '../services/whs';
import * as outcomes from '../services/outcomes';
import { NotFoundError, GuardError } from '../services/errors';
import { JURISDICTION_PROFILES } from '../domain/jurisdictions';

const store = seed();
const app = express();
app.use(express.json());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const ok = (res: Response, data: unknown) => res.json({ data });

app.get('/api/health', (_req, res) => ok(res, { status: 'ok', org: store.org.name }));
app.get('/api/jurisdictions', (_req, res) => ok(res, JURISDICTION_PROFILES));

app.get('/api/requests', (_req, res) => ok(res, wfh.list(store)));
app.post('/api/requests', (req, res) => ok(res, wfh.create(store, req.body)));
app.get('/api/requests/:id', (req, res) => ok(res, wfh.get(store, req.params.id)));
app.post('/api/requests/:id/assessment', (req, res) => ok(res, wfh.assess(store, req.params.id, req.body.factors ?? [])));
app.post('/api/requests/:id/distinguish', (req, res) => ok(res, wfh.distinguish(store, req.params.id, req.body.factor ?? '')));
app.post('/api/requests/:id/decision', (req, res) => ok(res, wfh.makeDecision(store, req.params.id, req.body.type, req.body.ground ?? '')));
app.get('/api/requests/:id/letter', (req, res) => ok(res, { letter: wfh.letter(store, req.params.id) }));

app.get('/api/hazards', (_req, res) => ok(res, whs.list(store)));
app.get('/api/hazards/:id/validation', (req, res) => ok(res, whs.validate(store, req.params.id)));
app.post('/api/hazards/:id/review', (req, res) => ok(res, whs.review(store, req.params.id, req.body.nextReviewDate ?? '')));

app.get('/api/contracts', (_req, res) => ok(res, outcomes.list(store)));
app.post('/api/contracts/:id/review', (req, res) => ok(res, outcomes.review(store, req.params.id)));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
  if (err instanceof GuardError) return res.status(409).json({ error: err.message }); // guardrail blocked
  return res.status(400).json({ error: err.message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Remit API on http://localhost:${port}`));
