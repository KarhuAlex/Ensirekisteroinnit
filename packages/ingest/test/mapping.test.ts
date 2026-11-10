import { describe, expect, it } from 'vitest';
import {
  buildEntities,
  codeFromPeriod,
  periodFromCode,
  slugify,
} from '../src/adapters/traficom-pxweb/mapping.js';

describe('slugify', () => {
  it('lowercases, strips diacritics and collapses separators', () => {
    expect(slugify('ACME ZX3')).toBe('acme-zx3');
    expect(slugify('Étoile C4 Nova')).toBe('etoile-c4-nova');
    expect(slugify('Alfa-Beta / EQA')).toBe('alfa-beta-eqa');
  });
});

describe('periodFromCode', () => {
  it('converts PxWeb month codes', () => {
    expect(periodFromCode('2014M01')).toBe('2014-01');
    expect(periodFromCode('2026M10')).toBe('2026-10');
  });
  it('rejects anything else', () => {
    expect(() => periodFromCode('2014')).toThrow();
  });
});

describe('buildEntities', () => {
  const { entities, idByCode } = buildEntities([
    { code: 'SSSS', label: 'Henkilöautot yhteensä' },
    { code: '206000', label: 'ACME yhteensä' },
    { code: 'ACME ZX3', label: 'ACME ZX3' },
    { code: '206I', label: 'ACME Z yhteensä' },
    { code: 'ACME Z3', label: 'ACME Z3' },
    { code: '202ORIONRS', label: 'ORION RS mallit yhteensä' },
    { code: '202000', label: 'ORION yhteensä' },
    { code: 'ORION RS3', label: 'ORION RS3' },
  ]);
  const byId = new Map(entities.map((e) => [e.id, e]));

  it('classifies rows by kind', () => {
    expect(byId.get('total')?.kind).toBe('total');
    expect(byId.get('acme')?.kind).toBe('make');
    expect(byId.get('acme-zx3')?.kind).toBe('model');
    expect(byId.get('orion-rs-mallit')?.kind).toBe('group');
  });

  it('attaches models to the longest matching make', () => {
    expect(byId.get('acme-zx3')?.makeId).toBe('acme');
    expect(byId.get('acme-z3')?.makeId).toBe('acme-z');
    expect(byId.get('orion-rs3')?.makeId).toBe('orion');
  });

  it('maps source codes to entity ids', () => {
    expect(idByCode.get('ACME ZX3')).toBe('acme-zx3');
    expect(idByCode.get('SSSS')).toBe('total');
  });

  it('keeps ids unique even when labels collide', () => {
    const dup = buildEntities([
      { code: 'A', label: 'ZETA' },
      { code: 'B', label: 'ZETA yhteensä' },
    ]);
    expect(new Set(dup.entities.map((e) => e.id)).size).toBe(2);
  });
});

describe('codeFromPeriod', () => {
  it('is the inverse of periodFromCode', () => {
    expect(codeFromPeriod('2026-03')).toBe('2026M03');
    expect(periodFromCode(codeFromPeriod('2014-12'))).toBe('2014-12');
  });
});
