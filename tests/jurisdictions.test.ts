import { describe, it, expect } from 'vitest';
import { JURISDICTION_PROFILES, ALL_JURISDICTIONS } from '../src/domain/jurisdictions.js';

describe('jurisdiction profiles', () => {
  it('covers all eight Australian jurisdictions', () => {
    expect(ALL_JURISDICTIONS.length).toBe(8);
  });

  it('marks VIC as non-harmonised, with a modified control hierarchy and a commencing WFH right', () => {
    const vic = JURISDICTION_PROFILES.VIC;
    expect(vic.harmonisedWhs).toBe(false);
    expect(vic.modifiedControlHierarchy).toBe(true);
    expect(vic.wfhRightCommences).toBe('2026-09-01');
  });

  it('every profile carries a letter prefix and all four frameworks', () => {
    for (const j of ALL_JURISDICTIONS) {
      const p = JURISDICTION_PROFILES[j];
      expect(p.letterPrefix).toBeTruthy();
      expect(p.wfhFramework && p.whsFramework && p.psychosocialInstrument && p.surveillanceRegime).toBeTruthy();
    }
  });
});
