import type { Dataset, FuelId } from '@regs/core';
import { describe, expect, it } from 'vitest';
import { CORPORATE_GROUPS, type CorporateGroupMapping } from '../src/config/corporate-groups.js';
import { reportCorporateGroups, withCorporateGroups } from '../src/pipeline/corporate-groups.js';
import { silentLogger, type Logger } from '../src/logger.js';

const mapping: CorporateGroupMapping = {
  asOf: '2026-11',
  groups: [
    { id: 'vag', label: 'VAG', makes: ['audi', 'skoda'] },
    { id: 'solo', label: 'Solo', makes: ['solo'] },
  ],
  ignored: ['caravans'],
};

const obs = (entityId: string, period: string, count: number, fuel: FuelId = 'petrol') => ({
  entityId,
  period,
  fuel,
  count,
});

function dataset(): Dataset {
  return {
    sourceId: 's',
    sourceName: 's',
    sourceUrl: 'u',
    licence: 'l',
    sourceVersion: 'v',
    sourceUpdated: 'v',
    notes: [],
    entities: [
      { id: 'total', label: 'All', kind: 'total' },
      { id: 'audi', label: 'Audi', kind: 'make' },
      { id: 'skoda', label: 'Skoda', kind: 'make' },
      { id: 'solo', label: 'Solo', kind: 'make' },
      { id: 'caravans', label: 'Caravans', kind: 'make' },
      { id: 'newbrand', label: 'New brand', kind: 'make' },
      { id: 'q5', label: 'Q5', kind: 'model', makeId: 'audi' },
    ],
    observations: [
      obs('audi', '2026-10', 5),
      obs('skoda', '2026-10', 7),
      obs('skoda', '2026-10', 2, 'bev'),
      obs('audi', '2026-09', 1),
      obs('solo', '2026-10', 3),
      obs('caravans', '2026-10', 4),
      obs('newbrand', '2026-10', 6),
      obs('q5', '2026-10', 5),
    ],
  };
}

describe('withCorporateGroups', () => {
  const result = withCorporateGroups(dataset(), mapping);
  const countOf = (id: string, period: string) =>
    result.observations
      .filter((o) => o.entityId === id && o.period === period)
      .reduce((sum, o) => sum + o.count, 0);

  it('adds a group entity of its own kind with a prefixed id', () => {
    const groups = result.entities.filter((e) => e.kind === 'corporategroup');
    expect(groups).toEqual([
      { id: 'cg-vag', label: 'VAG', kind: 'corporategroup' },
      { id: 'cg-solo', label: 'Solo', kind: 'corporategroup' },
    ]);
  });

  it('sums the makes of a group by month and fuel, and leaves the makes as they were', () => {
    expect(countOf('cg-vag', '2026-10')).toBe(14);
    expect(countOf('cg-vag', '2026-09')).toBe(1);
    expect(
      result.observations.filter((o) => o.entityId === 'cg-vag' && o.fuel === 'petrol'),
    ).toHaveLength(2);
    expect(countOf('audi', '2026-10')).toBe(5);
  });

  it('does not count models or makes outside the groups', () => {
    expect(countOf('cg-solo', '2026-10')).toBe(3);
    expect(result.entities.filter((e) => e.kind === 'corporategroup')).toHaveLength(2);
  });

  it('skips a group none of whose makes is in the data', () => {
    const noMakes = withCorporateGroups(
      { ...dataset(), entities: dataset().entities.filter((e) => e.id !== 'solo') },
      mapping,
    );
    expect(noMakes.entities.some((e) => e.id === 'cg-solo')).toBe(false);
  });

  it('refuses a make that is in two groups', () => {
    const twice: CorporateGroupMapping = {
      ...mapping,
      groups: [...mapping.groups, { id: 'other', label: 'Other', makes: ['audi'] }],
    };
    expect(() => withCorporateGroups(dataset(), twice)).toThrow(/both/);
  });

  it('refuses a group id that is already an entity id', () => {
    const clash: CorporateGroupMapping = {
      ...mapping,
      groups: [{ id: 'vag', label: 'VAG', makes: ['audi'] }],
    };
    const withClash = {
      ...dataset(),
      entities: [...dataset().entities, { id: 'cg-vag', label: 'x', kind: 'make' as const }],
    };
    expect(() => withCorporateGroups(withClash, clash)).toThrow(/already in use/);
  });
});

describe('reportCorporateGroups', () => {
  const warnings: string[] = [];
  const log: Logger = { ...silentLogger, warn: (m) => void warnings.push(m) };

  it('reports makes that sell cars but are in no group, except ignored ones', () => {
    warnings.length = 0;
    reportCorporateGroups(dataset(), mapping, log);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('newbrand (6)');
    expect(warnings[0]).not.toContain('caravans');
  });

  it('stops the run when coverage is below the minimum', () => {
    // 18 of 28 cars in the last 12 months are in a group, so 64.3 %.
    expect(() => reportCorporateGroups(dataset(), mapping, log, 0.97)).toThrow(/64\.3 %/);
    expect(() => reportCorporateGroups(dataset(), mapping, log, 0.6)).not.toThrow();
  });
});

describe('the corporate group mapping', () => {
  it('has unique group ids and puts each make in one group', () => {
    const ids = CORPORATE_GROUPS.groups.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const makes = CORPORATE_GROUPS.groups.flatMap((g) => g.makes);
    expect(new Set(makes).size).toBe(makes.length);
    expect(makes.filter((m) => CORPORATE_GROUPS.ignored.includes(m))).toEqual([]);
  });
});
