# Remit

Employer-side **workforce-flexibility governance** for Australia — work-from-home decisions, the
psychosocial/WHS duty, and outcome contracts. This repo is a runnable backend: a **pure domain core**,
a **service layer**, a **REST API**, and a **CLI**, all fully typed and tested.

> Remit is the **opposite of bossware**. It records the employer's decisions and duties — never the
> employee's activity. No keystrokes, screenshots or individual surveillance, anywhere.

## Quickstart
```bash
npm install
npm run prisma:generate   # generate Prisma client (required for Prisma backend mode)
npm run check     # strict typecheck + 25 Vitest tests
npm run demo      # runs the full governance loop in your terminal
npm start         # Remit API + web console on http://localhost:4000  (PORT=xxxx to change)
```

## What the demo proves (npm run demo)
1. Create an Account Manager / VIC request → 2. assessment runs the **consistency check** and FLAGS it
against a comparable prior approval → 3. a refusal is **BLOCKED by the guardrail** → 4. aligning +
approving issues letter **EO-VIC-02** and feeds the decision back into the prior-decision pool →
5. a WHS hazard review completes → 6. an outcome cycle review is recorded. Every step is enforced in code.

## REST API
```
GET  /api/health
GET  /api/jurisdictions
GET  /api/requests?limit=10&offset=0       POST /api/requests
GET  /api/requests/:id
POST /api/requests/:id/assessment          {factors:[...]}     -> runs consistency
POST /api/requests/:id/distinguish         {factor:"..."}      -> unlocks refusal
POST /api/requests/:id/decision            {type,ground}       -> 409 if guardrail blocks
GET  /api/requests/:id/letter
GET  /api/hazards?limit=10&offset=0        GET /api/hazards/:id/validation    POST /api/hazards/:id/review
GET  /api/contracts?limit=10&offset=0      POST /api/contracts/:id/review
```
Protected API routes (`/api/requests*`, `/api/hazards*`, `/api/contracts*`) require `x-org-id` header.
List endpoints return a pagination envelope:
`{ items: [...], page: { limit, offset, total, hasNext, hasPrev } }`.
The consistency guardrail returns **HTTP 409** when you try to refuse/modify a flagged request.

## Runtime backends
- Default: in-memory store (`src/store/memory.ts`).
- Prisma mode: set `REMIT_STORE_BACKEND=prisma` and `DATABASE_URL=postgres://...`.
  On first run, Remit seeds the configured org (`REMIT_ORG_ID`, defaults to `org_brightwater`) into Prisma.

## Web console
Open `http://localhost:4000` after `npm start` to use the live platform UI.
- Create and select WFH requests
- Run assessments and consistency checks
- Record distinguishing factors and decisions
- Preview generated decision letters
- Validate/review WHS hazards and record outcome cycle reviews
All interactions call the same guarded API/service/domain pipeline used by tests.

## Layout
```
src/domain/    pure, framework-agnostic IP (types, jurisdictions, consistency, decisions, hazards, outcomes, letters)
src/store/     in-memory org store + seed (swap for Prisma — see prisma/schema.prisma)
src/services/  orchestrates the domain over the store; enforces guardrails; appends audit
src/api/       Express REST server
src/cli.ts     end-to-end governance loop
prisma/        production schema (Milestone 2)
tests/         Vitest regression suites (domain + services)
AGENTS.md      Warp/agent project rules + roadmap (read this)
```

## Using it in Warp
1. `git init && git add -A && git commit -m "remit: backend + tests"`, open the folder in Warp.
2. Warp auto-loads **AGENTS.md** as project rules (`/init` to index the codebase).
3. **Agent Mode** (⌘+Enter macOS / Ctrl+Shift+Enter Linux/Win) — drive the roadmap. Example prompts:
   - "Read AGENTS.md. Implement Milestone 2: wire `prisma/schema.prisma`, generate the client, and
     replace `src/store/memory.ts` with Prisma-backed repositories that map rows to/from the domain
     types. Keep the domain pure and the services unchanged. Then run `npm run check`."
   - "Milestone 4: build the Next.js + Tailwind WFH Requests console and Decision File view calling the
     API, using the design tokens in AGENTS.md. Port the consistency-flag resolve flow."
   Keep `npm run check` green; mark every legal reference `// COUNSEL:`.

## Disclaimers
Illustrative scaffold, not legal advice — verify all legal references with Australian counsel before
production. The Victorian WFH right is a Bill, not yet an Act. "Remit" is a working name pending
trademark clearance. Data residency: Australia; APP-grade; no third-party data sharing.
