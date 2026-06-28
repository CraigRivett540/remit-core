import type { Jurisdiction } from './types';

// COUNSEL: every reference below is an illustrative scaffold and MUST be verified by qualified
// Australian counsel before production reliance. The Victorian WFH right is a Bill, not yet an Act.
export interface JurisdictionProfile {
  code: Jurisdiction;
  harmonisedWhs: boolean;
  wfhFramework: string;
  whsFramework: string;
  psychosocialInstrument: string;
  surveillanceRegime: string;
  letterPrefix: string;                 // EO-VIC | FW-NSW | ...
  modifiedControlHierarchy: boolean;    // true where training/info cannot be the sole control
  wfhRightCommences?: string;           // ISO date if a statutory right is enacted/proposed
}

export const JURISDICTION_PROFILES: Record<Jurisdiction, JurisdictionProfile> = {
  VIC: { code: 'VIC', harmonisedWhs: false, wfhFramework: 'Equal Opportunity Act 2010 (Vic) — statutory right (Bill, commencing)', whsFramework: 'OHS Act 2004 (Vic)', psychosocialInstrument: 'OHS (Psychological Health) Regulations 2025 (Vic)', surveillanceRegime: 'Surveillance Devices Act 1999 (Vic)', letterPrefix: 'EO-VIC', modifiedControlHierarchy: true, wfhRightCommences: '2026-09-01' },
  NSW: { code: 'NSW', harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS Act 2011 (NSW) + WHS Regulation 2025 (NSW)', psychosocialInstrument: 'Code of Practice: Managing Psychosocial Hazards (s 26A) + Digital Work Systems Act 2026 (NSW)', surveillanceRegime: 'Workplace Surveillance Act 2005 (NSW)', letterPrefix: 'FW-NSW', modifiedControlHierarchy: false },
  QLD: { code: 'QLD', harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS Act 2011 (Qld)', psychosocialInstrument: 'Managing the Risk of Psychosocial Hazards at Work Code 2022 (Qld)', surveillanceRegime: 'Invasion of Privacy Act 1971 (Qld) — no dedicated workplace regime', letterPrefix: 'FW-QLD', modifiedControlHierarchy: false },
  WA:  { code: 'WA',  harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS Act 2020 (WA) + WHS (General) Regulations 2022', psychosocialInstrument: 'Psychosocial hazards Code of Practice (WA)', surveillanceRegime: 'Surveillance Devices Act 1998 (WA)', letterPrefix: 'FW-WA', modifiedControlHierarchy: false },
  SA:  { code: 'SA',  harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS Act 2012 (SA)', psychosocialInstrument: 'Psychosocial hazards Code of Practice (SA)', surveillanceRegime: 'Surveillance Devices Act 2016 (SA)', letterPrefix: 'FW-SA', modifiedControlHierarchy: false },
  TAS: { code: 'TAS', harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS Act 2012 (Tas)', psychosocialInstrument: 'Psychosocial hazards Code of Practice (Tas)', surveillanceRegime: 'Workplace (Protection from Covert Surveillance) Act 2000 (Tas)', letterPrefix: 'FW-TAS', modifiedControlHierarchy: false },
  ACT: { code: 'ACT', harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS Act 2011 (ACT)', psychosocialInstrument: 'Managing psychosocial hazards Code (ACT)', surveillanceRegime: 'Workplace Privacy Act 2011 (ACT)', letterPrefix: 'FW-ACT', modifiedControlHierarchy: false },
  NT:  { code: 'NT',  harmonisedWhs: true, wfhFramework: 'Fair Work Act 2009 (Cth) s 65 — right to request', whsFramework: 'WHS (National Uniform Legislation) Act 2011 (NT)', psychosocialInstrument: 'Psychosocial hazards guidance (NT)', surveillanceRegime: 'Surveillance Devices Act 2007 (NT)', letterPrefix: 'FW-NT', modifiedControlHierarchy: false },
};

export const ALL_JURISDICTIONS = Object.keys(JURISDICTION_PROFILES) as Jurisdiction[];
