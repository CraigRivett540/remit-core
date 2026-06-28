# Remit — Project Rules (Warp Agent Mode)

> Warp auto-loads this file as project context. Canonical brief for building Remit. (`WARP.md` defers here.)

## What Remit is
Employer-side **workforce-flexibility governance** for Australia: it records the employer's WFH
**decisions**, the psychosocial/WHS **duty**, and **outcome**-based performance — consistent, defensible,
discharged.

## Non-negotiable — NOT bossware
Never implement, scaffold or suggest keystroke logging, screenshots, screen/app/URL activity tracking,
individual productivity scoring, or any individual-level surveillance. All wellbeing/outcome signals are
**aggregate, consent-based, delivery-state only**. If a task seems to need individual activity capture,
STOP and flag it.

## Architecture (already in place)
- `src/domain/**` — pure, framework-agnostic IP. No I/O. Holds the consistency engine, decision
  workflow, WHS hierarchy-of-controls guardrail, outcome contracts, jurisdiction profiles, letters.
- `src/services/**` — orchestrates the domain over a store; enforces guardrails; appends audit events.
- `src/store/memory.ts` — in-memory org store + seed (to be replaced by Prisma repositories, M2).
- `src/api/server.ts` — Express REST API. `src/cli.ts` — end-to-end loop.
- Build new layers on top; never duplicate domain logic in API/UI.

## Stack
TypeScript (strict) · Vitest (every domain/service function needs a test) · Express (API) ·
target app: **Next.js (App Router) + React + Tailwind** · **PostgreSQL via Prisma** (schema in `prisma/`).
Multi-tenant, org-scoped, 7-year retention.

## Hard rules for the agent
1. **Jurisdiction-parameterised** — read `JURISDICTION_PROFILES` (all 8 states); never hard-code one
   state's law. The Victorian WFH right is a **Bill** — keep it behind `wfhRightCommences`.
2. **Every legal reference is a `// COUNSEL:` scaffold** — not legal advice; verify before production.
3. **Audit everything** — every state change appends an `AuditEvent`; records immutable, retained 7 years.
4. **Never bypass `canDecide`** — an adverse WFH decision (refuse/modify) is blocked while a consistency
   flag is unresolved (API returns 409). Keep it that way.
5. **Privacy by design** — APP-grade, Australian residency, no third-party data sharing.
6. **Australian English** in UI copy; design tokens: forest-petrol `#123B33`, ochre `#C07A1E`, bone
   `#F4F2EC`; Spectral / Public Sans / IBM Plex Mono.
7. Run `npm run check` before declaring a task done.

## Roadmap
- **M1 — Domain core: DONE.**
- **M2 — Persistence: schema provided** (`prisma/schema.prisma`). Generate the client and replace
  `src/store/memory.ts` with Prisma repositories mapping rows to/from domain types; keep services unchanged.
- **M3 — Services + API: DONE (reference, in-memory).** Add validation, pagination, org auth context.
- **M4 — UI:** Next.js consoles (WFH Requests + Decision File, Wellbeing & WHS + Hazard File, Outcomes)
  and the employer registration wizard; port interactions from the prototype.
- **M5 — Multi-tenant & auth:** org onboarding, admin roles (GC / Head of People / HR Manager), RBAC.
- **M6 — Plug-in surface:** embeddable widget + API for HRIS marketplace distribution. No activity capture.

## Commands
`npm install` · `npm run demo` (CLI loop) · `npm start` (API) · `npm test` · `npm run check` (done-gate)
