import { PrismaClient } from '@prisma/client';
import type {
  AssessmentFactor,
  AuditEvent,
  ConsistencyResult,
  ConsistencyState,
  Control,
  ControlTier,
  Decision,
  DecisionType,
  Hazard,
  HazardStatus,
  HazardType,
  Jurisdiction,
  Outcome,
  OutcomeContract,
  OutcomeState,
  PriorDecision,
  Rating,
  RequestStatus,
} from '../domain/types.js';
import type { StoreRuntime } from './runtime.js';
import { seed, type Store } from './memory.js';

const DEFAULT_ORG_ID = 'org_brightwater';
const DEFAULT_ORG_NAME = 'Organisation';

// The domain/service/API layers operate on the in-memory `Store` contract. This adapter maps that
// contract onto the new relational CRM schema (Org, Employee, WfhRequest + relations, Hazard +
// relations, OutcomeContract + relations, AuditEntry) so persistence can evolve without touching
// the pure domain core.

const JURISDICTIONS: Jurisdiction[] = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

function toJurisdiction(value: string): Jurisdiction {
  return (JURISDICTIONS as string[]).includes(value) ? (value as Jurisdiction) : 'VIC';
}

function toRequestStatus(value: string): RequestStatus {
  switch (value) {
    case 'PENDING':
      return 'pending';
    case 'FLAGGED':
      return 'flagged';
    case 'APPROVED':
      return 'approved';
    case 'MODIFIED':
      return 'modified';
    case 'REFUSED':
      return 'refused';
    default:
      return 'pending';
  }
}

function fromRequestStatus(value: RequestStatus): 'PENDING' | 'FLAGGED' | 'APPROVED' | 'MODIFIED' | 'REFUSED' {
  switch (value) {
    case 'pending':
      return 'PENDING';
    case 'flagged':
      return 'FLAGGED';
    case 'approved':
      return 'APPROVED';
    case 'modified':
      return 'MODIFIED';
    case 'refused':
      return 'REFUSED';
    default:
      return 'PENDING';
  }
}

function toDecisionType(value: string): DecisionType {
  switch (value) {
    case 'APPROVED':
      return 'approved';
    case 'MODIFIED':
      return 'modified';
    case 'REFUSED':
      return 'refused';
    default:
      return 'approved';
  }
}

function fromDecisionType(value: DecisionType): 'APPROVED' | 'MODIFIED' | 'REFUSED' {
  switch (value) {
    case 'approved':
      return 'APPROVED';
    case 'modified':
      return 'MODIFIED';
    case 'refused':
      return 'REFUSED';
    default:
      return 'APPROVED';
  }
}

function toPriorStatus(value: string): PriorDecision['status'] {
  const status = toDecisionType(value);
  return status === 'approved' || status === 'modified' || status === 'refused' ? status : 'approved';
}

function toRating(value: string): Rating {
  switch (value) {
    case 'GREEN':
      return 'green';
    case 'AMBER':
      return 'amber';
    case 'RED':
      return 'red';
    default:
      return 'green';
  }
}

function fromRating(value: Rating): 'GREEN' | 'AMBER' | 'RED' {
  switch (value) {
    case 'green':
      return 'GREEN';
    case 'amber':
      return 'AMBER';
    case 'red':
      return 'RED';
    default:
      return 'GREEN';
  }
}

function toHazardType(value: string): HazardType {
  return value === 'PHYSICAL' ? 'physical' : 'psychosocial';
}

function fromHazardType(value: HazardType): 'PSYCHOSOCIAL' | 'PHYSICAL' {
  return value === 'physical' ? 'PHYSICAL' : 'PSYCHOSOCIAL';
}

function toHazardStatus(value: string): HazardStatus {
  switch (value) {
    case 'DUE':
      return 'due';
    case 'REVIEWED':
      return 'reviewed';
    case 'ONTRACK':
    default:
      return 'ontrack';
  }
}

function fromHazardStatus(value: HazardStatus): 'ONTRACK' | 'DUE' | 'REVIEWED' {
  switch (value) {
    case 'due':
      return 'DUE';
    case 'reviewed':
      return 'REVIEWED';
    case 'ontrack':
    default:
      return 'ONTRACK';
  }
}

function toContractStatus(value: string): OutcomeContract['status'] {
  switch (value) {
    case 'REVIEW':
      return 'review';
    case 'REVIEWED':
      return 'reviewed';
    case 'ONTRACK':
    default:
      return 'ontrack';
  }
}

function fromContractStatus(value: OutcomeContract['status']): 'ONTRACK' | 'REVIEW' | 'REVIEWED' {
  switch (value) {
    case 'review':
      return 'REVIEW';
    case 'reviewed':
      return 'REVIEWED';
    case 'ontrack':
    default:
      return 'ONTRACK';
  }
}

function toControlTier(value: string): ControlTier {
  return value === 'LOWER_ORDER' ? 'lower' : 'higher';
}

function fromControlTier(value: ControlTier): 'HIGHER_ORDER' | 'LOWER_ORDER' {
  return value === 'lower' ? 'LOWER_ORDER' : 'HIGHER_ORDER';
}

function toOutcomeState(value: string): OutcomeState {
  switch (value) {
    case 'DONE':
      return 'done';
    case 'PROGRESS':
      return 'progress';
    case 'NOTSTARTED':
    default:
      return 'notstarted';
  }
}

function fromOutcomeState(value: OutcomeState): 'DONE' | 'PROGRESS' | 'NOTSTARTED' {
  switch (value) {
    case 'done':
      return 'DONE';
    case 'progress':
      return 'PROGRESS';
    case 'notstarted':
    default:
      return 'NOTSTARTED';
  }
}

function toSignalSourceEnum(value: string): 'HRIS' | 'JIRA' | 'ASANA' | 'CRM' | 'TICKETS' | 'CALENDAR_META' {
  const upper = value.trim().toUpperCase();
  switch (upper) {
    case 'HRIS':
    case 'JIRA':
    case 'ASANA':
    case 'CRM':
    case 'TICKETS':
    case 'CALENDAR_META':
      return upper;
    default:
      return 'CRM';
  }
}

function consistencyStateToString(state: ConsistencyState): string {
  return state;
}

function stringToConsistencyState(value: string): ConsistencyState {
  switch (value) {
    case 'clear':
    case 'flag':
    case 'resolved':
    case 'pending':
      return value;
    default:
      return 'pending';
  }
}

function parseRequestSequence(id: string): number {
  const match = /^WFH-\d{4}-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

function deriveSequence(requests: readonly { id: string }[]): number {
  return requests.reduce((max, request) => Math.max(max, parseRequestSequence(request.id)), 0);
}

function asDate(value: string | Date | null | undefined): Date {
  const parsed = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function asDateFromDay(value: string): Date {
  return asDate(`${value}T00:00:00.000Z`);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? '')
      .join('') || '—'
  );
}

type LoadedRequest = Awaited<ReturnType<typeof loadRequests>>[number];

async function loadRequests(client: PrismaClient, orgId: string) {
  return client.wfhRequest.findMany({
    where: { org: orgId },
    orderBy: { submittedAt: 'desc' },
    include: {
      employee: true,
      assessment: { include: { dimensions: true } },
      consistency: true,
      decision: true,
      letter: true,
      audit: { orderBy: { at: 'asc' } },
    },
  });
}

function mapRequest(row: LoadedRequest): { request: import('../domain/types.js').WfhRequest } {
  const assessment: AssessmentFactor[] = (row.assessment?.dimensions ?? []).map((dimension) => ({
    key: dimension.id,
    label: dimension.dimension,
    rating: toRating(dimension.rag),
    note: dimension.finding,
  }));

  const consistency: ConsistencyResult = row.consistency
    ? {
        state: stringToConsistencyState(row.consistency.state),
        rationale: row.consistency.note ?? 'Runs once the assessment is complete.',
        comparatorId: row.consistency.comparatorRequestId ?? undefined,
        note: row.consistency.distinguishingFactor ?? undefined,
      }
    : { state: 'pending', rationale: 'Runs once the assessment is complete.' };

  const decision: Decision | undefined = row.decision
    ? {
        type: toDecisionType(row.decision.type),
        ground: row.decision.rationale,
        letterTemplate: row.letter?.templateCode ?? row.decision.groundCode ?? '',
        decidedAt: row.decision.decidedAt.toISOString(),
      }
    : undefined;

  const audit: AuditEvent[] = (row.audit ?? []).map((entry) => ({
    at: entry.at.toISOString(),
    event: entry.event,
  }));

  return {
    request: {
      id: row.id,
      employee: row.employee.name,
      role: row.employee.role,
      roleKey: row.employee.roleKey,
      jurisdiction: toJurisdiction(row.jurisdiction),
      days: row.requestedDays,
      pattern: row.pattern,
      assessment,
      assessmentComplete: Boolean(row.assessment?.completedAt),
      status: toRequestStatus(row.status),
      consistency,
      decision,
      audit,
    },
  };
}

async function loadStore(client: PrismaClient): Promise<Store> {
  const configuredOrgId = (process.env.REMIT_ORG_ID ?? DEFAULT_ORG_ID).trim();
  const org =
    (await client.org.findUnique({ where: { id: configuredOrgId }, include: { jurisdictions: true } })) ??
    (await client.org.findFirst({ orderBy: { createdAt: 'asc' }, include: { jurisdictions: true } }));

  if (!org) {
    const store = seed();
    store.org.id = configuredOrgId;
    await persistStore(client, store);
    return store;
  }

  const [requestRows, hazardRows, contractRows] = await Promise.all([
    loadRequests(client, org.id),
    client.hazard.findMany({
      where: { org: org.id },
      include: {
        controls: true,
        consultation: { orderBy: { consultedAt: 'asc' } },
        triggers: true,
        audit: { orderBy: { at: 'asc' } },
      },
    }),
    client.outcomeContract.findMany({
      where: { org: org.id },
      include: { employee: true, outcomes: true, audit: { orderBy: { at: 'asc' } } },
    }),
  ]);

  const requests = requestRows.map((row) => mapRequest(row).request);

  const priorDecisions: PriorDecision[] = requests
    .filter((request) => request.decision && (request.decision.type === 'approved' || request.decision.type === 'modified'))
    .map((request) => ({
      id: request.id,
      roleKey: request.roleKey,
      jurisdiction: request.jurisdiction,
      status: toPriorStatus(request.decision!.type.toUpperCase()),
      role: request.role,
      days: request.days,
      date: request.decision!.decidedAt,
    }));

  const hazards: Hazard[] = hazardRows.map((row) => ({
    id: row.id,
    name: row.name,
    type: toHazardType(row.type),
    jurisdiction: toJurisdiction(row.jurisdiction),
    controls: row.controls.map<Control>((control) => ({
      tier: toControlTier(control.tier),
      text: control.description,
      primary: control.applied,
    })),
    consultation: row.consultation.map((entry) => entry.views).join('; '),
    triggers: row.triggers.map((trigger) => trigger.label),
    status: toHazardStatus(row.status),
    reviewDate: row.reviewDate.toISOString().slice(0, 10),
    audit: row.audit.map((entry) => ({ at: entry.at.toISOString(), event: entry.event })),
  }));

  const contracts: OutcomeContract[] = contractRows.map((row) => ({
    id: row.id,
    employee: row.employee.name,
    jurisdiction: toJurisdiction(row.jurisdiction),
    period: row.period,
    outcomes: row.outcomes.map<Outcome>((outcome) => ({
      text: outcome.description,
      state: toOutcomeState(outcome.status),
    })),
    signalSource: row.signalSource,
    status: toContractStatus(row.status),
    audit: row.audit.map((entry) => ({ at: entry.at.toISOString(), event: entry.event })),
  }));

  return {
    org: {
      id: org.id,
      name: org.name,
      jurisdictions: org.jurisdictions.map((entry) => toJurisdiction(entry.code)),
    },
    seq: deriveSequence(requests),
    requests,
    priorDecisions,
    hazards,
    contracts,
  };
}

async function persistStore(client: PrismaClient, store: Store): Promise<void> {
  const orgId = store.org.id;
  const systemUsers = {
    assessor: `${orgId}__assessor`,
    decider: `${orgId}__decider`,
    reviewer: `${orgId}__reviewer`,
  };

  await client.$transaction(async (tx) => {
    await tx.org.upsert({
      where: { id: orgId },
      create: { id: orgId, name: store.org.name || DEFAULT_ORG_NAME },
      update: { name: store.org.name || DEFAULT_ORG_NAME },
    });

    await tx.user.upsert({
      where: { id: systemUsers.assessor },
      create: {
        id: systemUsers.assessor,
        orgId,
        name: 'System Assessor',
        email: `${systemUsers.assessor}@remit.local`,
        role: 'ASSESSOR',
      },
      update: {
        orgId,
        name: 'System Assessor',
        email: `${systemUsers.assessor}@remit.local`,
        role: 'ASSESSOR',
      },
    });
    await tx.user.upsert({
      where: { id: systemUsers.decider },
      create: {
        id: systemUsers.decider,
        orgId,
        name: 'System Decision Maker',
        email: `${systemUsers.decider}@remit.local`,
        role: 'DECISION_MAKER',
      },
      update: {
        orgId,
        name: 'System Decision Maker',
        email: `${systemUsers.decider}@remit.local`,
        role: 'DECISION_MAKER',
      },
    });
    await tx.user.upsert({
      where: { id: systemUsers.reviewer },
      create: {
        id: systemUsers.reviewer,
        orgId,
        name: 'System WHS Reviewer',
        email: `${systemUsers.reviewer}@remit.local`,
        role: 'WHS_LEAD',
      },
      update: {
        orgId,
        name: 'System WHS Reviewer',
        email: `${systemUsers.reviewer}@remit.local`,
        role: 'WHS_LEAD',
      },
    });

    await tx.orgJurisdiction.deleteMany({ where: { orgId } });
    if (store.org.jurisdictions.length > 0) {
      await tx.orgJurisdiction.createMany({
        data: store.org.jurisdictions.map((code) => ({ orgId, code })),
      });
    }

    await tx.auditEntry.deleteMany({ where: { org: orgId } });
    await tx.assessmentDimension.deleteMany({ where: { assessment: { request: { org: orgId } } } });
    await tx.wfhAssessment.deleteMany({ where: { request: { org: orgId } } });
    await tx.consistencyResult.deleteMany({ where: { request: { org: orgId } } });
    await tx.wfhDecision.deleteMany({ where: { request: { org: orgId } } });
    await tx.decisionLetter.deleteMany({ where: { request: { org: orgId } } });
    await tx.wfhRequest.deleteMany({ where: { org: orgId } });

    await tx.hazardControl.deleteMany({ where: { hazard: { org: orgId } } });
    await tx.consultation.deleteMany({ where: { hazard: { org: orgId } } });
    await tx.reviewTrigger.deleteMany({ where: { hazard: { org: orgId } } });
    await tx.controlReview.deleteMany({ where: { hazard: { org: orgId } } });
    await tx.hazard.deleteMany({ where: { org: orgId } });

    await tx.outcomeItem.deleteMany({ where: { contract: { org: orgId } } });
    await tx.cycleReview.deleteMany({ where: { contract: { org: orgId } } });
    await tx.outcomeContract.deleteMany({ where: { org: orgId } });
    await tx.whsSelfAssessment.deleteMany({ where: { employee: { orgId } } });
    await tx.signalAggregate.deleteMany({ where: { org: orgId } });
    await tx.employee.deleteMany({ where: { orgId } });

    const employeeKey = (name: string, role: string, jurisdiction: Jurisdiction) =>
      `${name}__${role}__${jurisdiction}`;
    const employeeIdByKey = new Map<string, string>();

    const ensureEmployee = async (
      name: string,
      role: string,
      roleKey: string,
      jurisdiction: Jurisdiction,
    ): Promise<string> => {
      const key = employeeKey(name, role, jurisdiction);
      const existing = employeeIdByKey.get(key);
      if (existing) return existing;
      const created = await tx.employee.create({
        data: {
          orgId,
          name,
          initials: initialsOf(name),
          role,
          roleKey,
          jurisdiction,
        },
      });
      employeeIdByKey.set(key, created.id);
      return created.id;
    };

    for (const request of store.requests) {
      const employeeId = await ensureEmployee(
        request.employee,
        request.role,
        request.roleKey,
        request.jurisdiction,
      );

      await tx.wfhRequest.create({
        data: {
          id: request.id,
          org: orgId,
          employeeId,
          jurisdiction: request.jurisdiction,
          requestedDays: request.days,
          pattern: request.pattern,
          wfhLocation: `Home (${request.jurisdiction})`,
          status: fromRequestStatus(request.status),
        },
      });

      if (request.assessment.length > 0 || request.assessmentComplete) {
        await tx.wfhAssessment.create({
          data: {
            requestId: request.id,
            assessorId: systemUsers.assessor,
            completedAt: request.assessmentComplete ? asDate(request.decision?.decidedAt ?? request.audit[0]?.at) : null,
            dimensions: {
              create: request.assessment.map((factor) => ({
                dimension: factor.label,
                finding: factor.note,
                rag: fromRating(factor.rating),
              })),
            },
          },
        });
      }

      await tx.consistencyResult.create({
        data: {
          requestId: request.id,
          state: consistencyStateToString(request.consistency.state),
          comparatorRequestId: request.consistency.comparatorId ?? null,
          note: request.consistency.rationale ?? null,
          distinguishingFactor: request.consistency.note ?? null,
        },
      });

      if (request.decision) {
        await tx.wfhDecision.create({
          data: {
            requestId: request.id,
            deciderId: systemUsers.decider,
            type: fromDecisionType(request.decision.type),
            groundCode: request.decision.letterTemplate || null,
            rationale: request.decision.ground,
            decidedAt: asDate(request.decision.decidedAt),
            finalised: true,
          },
        });
        await tx.decisionLetter.create({
          data: {
            requestId: request.id,
            templateCode: request.decision.letterTemplate || '',
            renderedMd: '',
            issued: true,
            issuedAt: asDate(request.decision.decidedAt),
          },
        });
      }

      if (request.audit.length > 0) {
        await tx.auditEntry.createMany({
          data: request.audit.map((event) => ({
            org: orgId,
            at: asDate(event.at),
            actor: 'system',
            event: event.event,
            locked: Boolean(request.decision),
            requestId: request.id,
          })),
        });
      }
    }

    for (const hazard of store.hazards) {
      await tx.hazard.create({
        data: {
          id: hazard.id,
          org: orgId,
          name: hazard.name,
          type: fromHazardType(hazard.type),
          jurisdiction: hazard.jurisdiction,
          status: fromHazardStatus(hazard.status),
          identification: 'Recorded via governance console',
          riskAssessment: hazard.consultation || 'Aggregate risk note pending.',
          frameworkInstrument: 'COUNSEL: verify jurisdiction instrument',
          reviewDate: asDateFromDay(hazard.reviewDate),
          controls: {
            create: hazard.controls.map((control) => ({
              tier: fromControlTier(control.tier),
              description: control.text,
              applied: Boolean(control.primary),
              appliedAt: control.primary ? asDate(hazard.audit[0]?.at) : null,
            })),
          },
          triggers: {
            create: hazard.triggers.map((label) => ({ label })),
          },
          consultation: hazard.consultation
            ? { create: [{ views: hazard.consultation, workersConsulted: true }] }
            : undefined,
        },
      });

      if (hazard.audit.length > 0) {
        await tx.auditEntry.createMany({
          data: hazard.audit.map((event) => ({
            org: orgId,
            at: asDate(event.at),
            actor: 'system',
            event: event.event,
            locked: hazard.status === 'reviewed',
            hazardId: hazard.id,
          })),
        });
      }
    }

    for (const contract of store.contracts) {
      const employeeId = await ensureEmployee(
        contract.employee,
        contract.employee,
        contract.employee.toLowerCase(),
        contract.jurisdiction,
      );

      await tx.outcomeContract.create({
        data: {
          id: contract.id,
          org: orgId,
          employeeId,
          jurisdiction: contract.jurisdiction,
          period: contract.period,
          signalSource: toSignalSourceEnum(contract.signalSource),
          status: fromContractStatus(contract.status),
          outcomes: {
            create: contract.outcomes.map((outcome) => ({
              description: outcome.text,
              status: fromOutcomeState(outcome.state),
            })),
          },
        },
      });

      if (contract.audit.length > 0) {
        await tx.auditEntry.createMany({
          data: contract.audit.map((event) => ({
            org: orgId,
            at: asDate(event.at),
            actor: 'system',
            event: event.event,
            locked: contract.status === 'reviewed',
            contractId: contract.id,
          })),
        });
      }
    }
  });
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