import { PrismaClient, Prisma, type ContractStatus, type HazardStatus, type HazardType, type Jurisdiction, type RequestStatus } from '@prisma/client';
import type { AssessmentFactor, ConsistencyResult, Decision, Outcome, Hazard, OutcomeContract, PriorDecision, WfhRequest } from '../domain/types.js';
import type { StoreRuntime } from './runtime.js';
import { seed, type Store } from './memory.js';

const DEFAULT_ORG_ID = 'org_brightwater';

function parseRequestSequence(id: string): number {
  const match = /^WFH-\d{4}-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function deriveSequence(requests: readonly WfhRequest[]): number {
  const seq = requests.reduce((max, request) => Math.max(max, parseRequestSequence(request.id)), 0);
  return seq > 0 ? seq : 142;
}

function asObject<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
  return fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toRequestStatus(status: string): RequestStatus {
  if (status === 'pending' || status === 'flagged' || status === 'approved' || status === 'modified' || status === 'refused') {
    return status;
  }
  return 'pending';
}

function toHazardStatus(status: string): HazardStatus {
  if (status === 'ontrack' || status === 'due' || status === 'reviewed') return status;
  return 'ontrack';
}

function toContractStatus(status: string): ContractStatus {
  if (status === 'ontrack' || status === 'review' || status === 'reviewed') return status;
  return 'ontrack';
}

function toHazardType(type: string): HazardType {
  if (type === 'psychosocial' || type === 'physical') return type;
  return 'psychosocial';
}

function mapRequest(row: {
  id: string;
  employee: string;
  role: string;
  roleKey: string;
  jurisdiction: Jurisdiction;
  days: string;
  pattern: string;
  assessment: unknown;
  assessmentComplete: boolean;
  status: string;
  consistency: unknown;
  decision: unknown;
  audit: unknown;
}): WfhRequest {
  const decision = row.decision && typeof row.decision === 'object' && !Array.isArray(row.decision)
    ? row.decision as Decision
    : undefined;
  return {
    id: row.id,
    employee: row.employee,
    role: row.role,
    roleKey: row.roleKey,
    jurisdiction: row.jurisdiction,
    days: row.days,
    pattern: row.pattern,
    assessment: asArray<AssessmentFactor>(row.assessment),
    assessmentComplete: row.assessmentComplete,
    status: toRequestStatus(row.status),
    consistency: asObject<ConsistencyResult>(row.consistency, {
      state: 'pending',
      rationale: 'Runs once the assessment is complete.',
    }),
    decision,
    audit: asArray<WfhRequest['audit'][number]>(row.audit),
  };
}

function mapPrior(row: {
  id: string;
  roleKey: string;
  jurisdiction: Jurisdiction;
  status: string;
  role: string | null;
  days: string | null;
  decidedOn: string | null;
}): PriorDecision {
  const status: PriorDecision['status'] =
    row.status === 'approved' || row.status === 'modified' || row.status === 'refused'
      ? row.status
      : 'approved';
  return {
    id: row.id,
    roleKey: row.roleKey,
    jurisdiction: row.jurisdiction,
    status,
    role: row.role ?? undefined,
    days: row.days ?? undefined,
    date: row.decidedOn ?? undefined,
  };
}

function mapHazard(row: {
  id: string;
  name: string;
  type: string;
  jurisdiction: Jurisdiction;
  controls: unknown;
  consultation: string;
  triggers: unknown;
  status: string;
  reviewDate: string;
  audit: unknown;
}): Hazard {
  return {
    id: row.id,
    name: row.name,
    type: toHazardType(row.type),
    jurisdiction: row.jurisdiction,
    controls: asArray<Hazard['controls'][number]>(row.controls),
    consultation: row.consultation,
    triggers: asArray<string>(row.triggers),
    status: toHazardStatus(row.status),
    reviewDate: row.reviewDate,
    audit: asArray<Hazard['audit'][number]>(row.audit),
  };
}

function mapContract(row: {
  id: string;
  employee: string;
  jurisdiction: Jurisdiction;
  period: string;
  outcomes: unknown;
  signalSource: string;
  status: string;
  audit: unknown;
}): OutcomeContract {
  return {
    id: row.id,
    employee: row.employee,
    jurisdiction: row.jurisdiction,
    period: row.period,
    outcomes: asArray<Outcome>(row.outcomes),
    signalSource: row.signalSource,
    status: toContractStatus(row.status),
    audit: asArray<OutcomeContract['audit'][number]>(row.audit),
  };
}

async function persistStore(client: PrismaClient, store: Store): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.organisation.upsert({
      where: { id: store.org.id },
      create: {
        id: store.org.id,
        name: store.org.name,
        jurisdictions: store.org.jurisdictions,
      },
      update: {
        name: store.org.name,
        jurisdictions: store.org.jurisdictions,
      },
    });

    await tx.wfhRequest.deleteMany({ where: { orgId: store.org.id } });
    if (store.requests.length > 0) {
      await tx.wfhRequest.createMany({
        data: store.requests.map((request) => ({
          id: request.id,
          orgId: store.org.id,
          employee: request.employee,
          role: request.role,
          roleKey: request.roleKey,
          jurisdiction: request.jurisdiction,
          days: request.days,
          pattern: request.pattern,
          assessment: toInputJson(request.assessment),
          assessmentComplete: request.assessmentComplete,
          status: request.status,
          consistency: toInputJson(request.consistency),
          decision: request.decision ? toInputJson(request.decision) : undefined,
          audit: toInputJson(request.audit),
        })),
      });
    }

    await tx.priorDecision.deleteMany({ where: { orgId: store.org.id } });
    if (store.priorDecisions.length > 0) {
      await tx.priorDecision.createMany({
        data: store.priorDecisions.map((prior) => ({
          id: prior.id,
          orgId: store.org.id,
          roleKey: prior.roleKey,
          jurisdiction: prior.jurisdiction,
          status: prior.status,
          role: prior.role ?? null,
          days: prior.days ?? null,
          decidedOn: prior.date ?? null,
        })),
      });
    }

    await tx.hazard.deleteMany({ where: { orgId: store.org.id } });
    if (store.hazards.length > 0) {
      await tx.hazard.createMany({
        data: store.hazards.map((hazard) => ({
          id: hazard.id,
          orgId: store.org.id,
          name: hazard.name,
          type: hazard.type,
          jurisdiction: hazard.jurisdiction,
          controls: toInputJson(hazard.controls),
          consultation: hazard.consultation,
          triggers: toInputJson(hazard.triggers),
          status: hazard.status,
          reviewDate: hazard.reviewDate,
          audit: toInputJson(hazard.audit),
        })),
      });
    }

    await tx.outcomeContract.deleteMany({ where: { orgId: store.org.id } });
    if (store.contracts.length > 0) {
      await tx.outcomeContract.createMany({
        data: store.contracts.map((contract) => ({
          id: contract.id,
          orgId: store.org.id,
          employee: contract.employee,
          jurisdiction: contract.jurisdiction,
          period: contract.period,
          outcomes: toInputJson(contract.outcomes),
          signalSource: contract.signalSource,
          status: contract.status,
          audit: toInputJson(contract.audit),
        })),
      });
    }
  });
}

async function loadStore(client: PrismaClient): Promise<Store> {
  const configuredOrgId = (process.env.REMIT_ORG_ID ?? DEFAULT_ORG_ID).trim();
  const organisation =
    await client.organisation.findUnique({ where: { id: configuredOrgId } }) ??
    await client.organisation.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!organisation) {
    const store = seed();
    store.org.id = configuredOrgId;
    await persistStore(client, store);
    return store;
  }

  const [requests, priorDecisions, hazards, contracts] = await Promise.all([
    client.wfhRequest.findMany({ where: { orgId: organisation.id }, orderBy: { createdAt: 'desc' } }),
    client.priorDecision.findMany({ where: { orgId: organisation.id } }),
    client.hazard.findMany({ where: { orgId: organisation.id } }),
    client.outcomeContract.findMany({ where: { orgId: organisation.id } }),
  ]);

  const mappedRequests = requests.map(mapRequest);
  return {
    org: {
      id: organisation.id,
      name: organisation.name,
      jurisdictions: organisation.jurisdictions,
    },
    seq: deriveSequence(mappedRequests),
    requests: mappedRequests,
    priorDecisions: priorDecisions.map(mapPrior),
    hazards: hazards.map(mapHazard),
    contracts: contracts.map(mapContract),
  };
}

export async function createPrismaStoreRuntime(): Promise<StoreRuntime | null> {
  try {
    const client = new PrismaClient();
    await client.$connect();
    const store = await loadStore(client);

    return {
      backend: 'prisma',
      orgId: store.org.id,
      store,
      flush: async () => {
        await persistStore(client, store);
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Remit] Prisma backend unavailable, using memory store. Reason: ${message}`);
    return null;
  }
}
