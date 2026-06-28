// Remit domain types. Pure data — no I/O, no framework, no surveillance.
export type Jurisdiction = 'VIC' | 'NSW' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type DecisionType = 'approved' | 'modified' | 'refused';
export type RequestStatus = 'pending' | 'flagged' | 'approved' | 'modified' | 'refused';
export type Rating = 'green' | 'amber' | 'red';
export type ControlTier = 'higher' | 'lower';
export type HazardType = 'psychosocial' | 'physical';
export type HazardStatus = 'ontrack' | 'due' | 'reviewed';
export type ConsistencyState = 'pending' | 'clear' | 'flag' | 'resolved';
export type OutcomeState = 'done' | 'progress' | 'notstarted';
export type ContractStatus = 'ontrack' | 'review' | 'reviewed';

export interface AuditEvent { at: string; event: string; }

export interface AssessmentFactor { key: string; label: string; rating: Rating; note: string; }

export interface ConsistencyResult {
  state: ConsistencyState;
  rationale: string;
  comparatorId?: string;
  recommendation?: string;
  note?: string;
}

export interface Decision {
  type: DecisionType;
  ground: string;
  letterTemplate: string;
  decidedAt: string;
}

export interface WfhRequest {
  id: string;
  employee: string;
  roleKey: string;   // normalised role key, e.g. 'account manager'
  role: string;
  jurisdiction: Jurisdiction;
  days: string;
  pattern: string;
  assessment: AssessmentFactor[];
  assessmentComplete: boolean;
  status: RequestStatus;
  consistency: ConsistencyResult;
  decision?: Decision;
  audit: AuditEvent[];
}

export interface PriorDecision {
  id: string;
  roleKey: string;
  jurisdiction: Jurisdiction;
  status: Extract<RequestStatus, 'approved' | 'modified' | 'refused'>;
  role?: string;
  days?: string;
  date?: string;
}

export interface Control { tier: ControlTier; text: string; primary?: boolean; }

export interface Hazard {
  id: string;
  name: string;
  type: HazardType;
  jurisdiction: Jurisdiction;
  controls: Control[];
  consultation: string;
  triggers: string[];
  status: HazardStatus;
  reviewDate: string;
  audit: AuditEvent[];
}

export interface Outcome { text: string; state: OutcomeState; }

export interface OutcomeContract {
  id: string;
  employee: string;
  jurisdiction: Jurisdiction;
  period: string;
  outcomes: Outcome[];
  signalSource: string;   // e.g. 'CRM' | 'Jira' — delivery state only, never activity
  status: ContractStatus;
  audit: AuditEvent[];
}
