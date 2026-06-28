-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ASSESSOR', 'DECISION_MAKER', 'WHS_LEAD', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('HRIS', 'JIRA', 'ASANA', 'CRM', 'TICKETS', 'CALENDAR_META');

-- CreateEnum
CREATE TYPE "Jurisdiction" AS ENUM ('VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'FLAGGED', 'APPROVED', 'MODIFIED', 'REFUSED');

-- CreateEnum
CREATE TYPE "Rag" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('APPROVED', 'MODIFIED', 'REFUSED');

-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('PSYCHOSOCIAL', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "HazardStatus" AS ENUM ('ONTRACK', 'DUE', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ControlTier" AS ENUM ('HIGHER_ORDER', 'LOWER_ORDER');

-- CreateEnum
CREATE TYPE "SignalMetric" AS ENUM ('AFTER_HOURS_INDEX', 'CONNECTION_SCORE', 'WORKLOAD_SUSTAINABILITY', 'RIGHT_TO_DISCONNECT_ADHERENCE', 'WHS_ASSESSMENT_COMPLETION');

-- CreateEnum
CREATE TYPE "OutcomeStatus" AS ENUM ('ONTRACK', 'REVIEW', 'REVIEWED');

-- CreateEnum
CREATE TYPE "OutcomeItemStatus" AS ENUM ('DONE', 'PROGRESS', 'NOTSTARTED');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abn" TEXT,
    "dataResidency" TEXT NOT NULL DEFAULT 'AU',
    "retentionYrs" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgJurisdiction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" "Jurisdiction" NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "ruleProfileId" TEXT,

    CONSTRAINT "OrgJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isHsr" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "counselApprovedBy" TEXT,
    "counselApprovedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceProfile" (
    "id" TEXT NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "wfhInstrument" TEXT NOT NULL,
    "whsInstrument" TEXT NOT NULL,
    "surveilInstrument" TEXT NOT NULL,
    "harmonisation" TEXT NOT NULL,
    "reformWatch" JSONB NOT NULL,
    "compiledTo" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "initials" TEXT,
    "role" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "homeLocation" TEXT,
    "employmentBasis" TEXT,
    "team" TEXT,
    "managerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfhRequest" (
    "id" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "requestedDays" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "wfhLocation" TEXT NOT NULL,
    "requestedStart" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "WfhRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfhAssessment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WfhAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentDimension" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "rag" "Rag" NOT NULL,

    CONSTRAINT "AssessmentDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhsSelfAssessment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "result" TEXT NOT NULL,
    "remediation" TEXT,
    "equipmentIssued" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WhsSelfAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsistencyResult" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "comparatorRequestId" TEXT,
    "note" TEXT,
    "distinguishingFactor" TEXT,
    "distinguishedBy" TEXT,
    "distinguishedAt" TIMESTAMP(3),

    CONSTRAINT "ConsistencyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfhDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "deciderId" TEXT NOT NULL,
    "type" "DecisionType" NOT NULL,
    "groundCode" TEXT,
    "rationale" TEXT NOT NULL,
    "alternativeOffer" TEXT,
    "reviewableAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalised" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WfhDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefusalGround" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RefusalGround_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DecisionLetter" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "renderedMd" TEXT NOT NULL,
    "issued" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hazard" (
    "id" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HazardType" NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "status" "HazardStatus" NOT NULL DEFAULT 'ONTRACK',
    "identification" TEXT NOT NULL,
    "riskAssessment" TEXT NOT NULL,
    "frameworkInstrument" TEXT NOT NULL,
    "frameworkCode" TEXT,
    "frameworkNote" TEXT,
    "reviewDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazardControl" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "tier" "ControlTier" NOT NULL,
    "description" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "HazardControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "hsrName" TEXT,
    "workersConsulted" BOOLEAN NOT NULL DEFAULT false,
    "views" TEXT NOT NULL,
    "consultedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTrigger" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ReviewTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlReview" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalAggregate" (
    "id" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "team" TEXT,
    "metric" "SignalMetric" NOT NULL,
    "period" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" "IntegrationKind" NOT NULL,

    CONSTRAINT "SignalAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseResponse" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "metric" "SignalMetric" NOT NULL,
    "value" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeContract" (
    "id" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "period" TEXT NOT NULL,
    "signalSource" "IntegrationKind" NOT NULL,
    "status" "OutcomeStatus" NOT NULL DEFAULT 'ONTRACK',
    "coSetAt" TIMESTAMP(3),
    "employeeAcknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OutcomeContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "OutcomeItemStatus" NOT NULL DEFAULT 'NOTSTARTED',
    "externalRef" TEXT,

    CONSTRAINT "OutcomeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleReview" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "signedOff" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "event" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "requestId" TEXT,
    "hazardId" TEXT,
    "contractId" TEXT,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgJurisdiction_orgId_code_key" ON "OrgJurisdiction"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LetterTemplate_orgId_code_key" ON "LetterTemplate"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_orgId_kind_key" ON "Integration"("orgId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceProfile_jurisdiction_key" ON "ComplianceProfile"("jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "WfhAssessment_requestId_key" ON "WfhAssessment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsistencyResult_requestId_key" ON "ConsistencyResult"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "WfhDecision_requestId_key" ON "WfhDecision"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionLetter_requestId_key" ON "DecisionLetter"("requestId");

-- CreateIndex
CREATE INDEX "AuditEntry_org_at_idx" ON "AuditEntry"("org", "at");

-- AddForeignKey
ALTER TABLE "OrgJurisdiction" ADD CONSTRAINT "OrgJurisdiction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhRequest" ADD CONSTRAINT "WfhRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhAssessment" ADD CONSTRAINT "WfhAssessment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WfhRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhAssessment" ADD CONSTRAINT "WfhAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDimension" ADD CONSTRAINT "AssessmentDimension_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "WfhAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhsSelfAssessment" ADD CONSTRAINT "WhsSelfAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsistencyResult" ADD CONSTRAINT "ConsistencyResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WfhRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhDecision" ADD CONSTRAINT "WfhDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WfhRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhDecision" ADD CONSTRAINT "WfhDecision_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLetter" ADD CONSTRAINT "DecisionLetter_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WfhRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardControl" ADD CONSTRAINT "HazardControl_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTrigger" ADD CONSTRAINT "ReviewTrigger_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlReview" ADD CONSTRAINT "ControlReview_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlReview" ADD CONSTRAINT "ControlReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeContract" ADD CONSTRAINT "OutcomeContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeItem" ADD CONSTRAINT "OutcomeItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "OutcomeContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleReview" ADD CONSTRAINT "CycleReview_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "OutcomeContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "WfhRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "OutcomeContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

