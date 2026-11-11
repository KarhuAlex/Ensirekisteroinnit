import {
  TOTAL_ENTITY_ID,
  type Area,
  type Entity,
  type FuelGroupId,
  type FuelId,
  type Period,
} from '@regs/core';

/** Traficom fuel codes (table 050_ensirek_tau_105) mapped to canonical fuel ids. */
export const FUEL_CODE_MAP: Readonly<Record<string, FuelId>> = {
  '01': 'petrol',
  '02': 'diesel',
  '04': 'bev',
  '13': 'cng',
  '38': 'petrol_cng',
  '39': 'phev_petrol',
  '40': 'petrol_ethanol',
  '44': 'phev_diesel',
  Y: 'other',
};

/**
 * Fuel codes of the table of cars imported used. It has more classes than the registrations table;
 * those without a canonical fuel of their own go under `other`.
 */
export const USED_FUEL_CODE_MAP: Readonly<Record<string, FuelId>> = {
  '01': 'petrol',
  '02': 'diesel',
  '03': 'other',
  '04': 'bev',
  '05': 'other',
  '06': 'other',
  '11': 'other',
  '13': 'cng',
  '37': 'other',
  '38': 'petrol_cng',
  '39': 'phev_petrol',
  '40': 'petrol_ethanol',
  '42': 'other',
  '44': 'phev_diesel',
  Y: 'other',
};

/**
 * Fuel codes of the table of cars in traffic, which has more classes than the registrations table.
 * It counts cars, not registrations, so the groups are the coarse ones. Hybrids that cannot be
 * plugged in are counted under petrol or diesel by the source and stay there.
 */
export const STOCK_FUEL_GROUP_MAP: Readonly<Record<string, FuelGroupId>> = {
  '01': 'petrol',
  '02': 'diesel',
  '04': 'bev',
  '39': 'phev',
  '44': 'phev',
  '03': 'other',
  '05': 'other',
  '06': 'other',
  '10': 'other',
  '11': 'other',
  '13': 'other',
  '31': 'other',
  '33': 'other',
  '34': 'other',
  '37': 'other',
  '38': 'other',
  '40': 'other',
  '41': 'other',
  '42': 'other',
  '43': 'other',
  '56': 'other',
  '65': 'other',
  '67': 'other',
  Y: 'other',
};

/** Code of the "all fuels" row; used for cross-checking, never published. */
export const FUEL_TOTAL_CODE = 'YH';

/** Code of the "all passenger cars" row in the model-series variable. */
export const ALL_CARS_CODE = 'SSSS';

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function periodFromCode(code: string): Period {
  const match = /^(\d{4})M(\d{2})$/.exec(code);
  if (!match) throw new Error(`Unexpected month code: ${code}`);
  return `${match[1]}-${match[2]}`;
}

export function codeFromPeriod(period: Period): string {
  return period.replace('-', 'M');
}

export interface SourceValue {
  code: string;
  label: string;
}

const TOTAL_SUFFIX = /\s+yhteensä$/i;

/**
 * Derives canonical entities from the model-series list. The source mixes four kinds of rows in
 * one list (grand total, make totals, model-group totals, models). The kind comes from the
 * label, and models attach to the longest matching make name.
 */
export function buildEntities(values: readonly SourceValue[]): {
  entities: Entity[];
  idByCode: Map<string, string>;
} {
  const usedIds = new Set<string>();
  const idByCode = new Map<string, string>();
  const drafts: { code: string; label: string; kind: Entity['kind'] }[] = [];

  for (const { code, label } of values) {
    if (code === ALL_CARS_CODE) {
      drafts.push({ code, label: 'All passenger cars', kind: 'total' });
    } else if (TOTAL_SUFFIX.test(label)) {
      const base = label.replace(TOTAL_SUFFIX, '').trim();
      drafts.push({ code, label: base, kind: /\bmallit$/i.test(base) ? 'group' : 'make' });
    } else {
      drafts.push({ code, label: label.trim(), kind: 'model' });
    }
  }

  const makes = drafts
    .filter((d) => d.kind === 'make')
    .map((d) => d.label.toUpperCase())
    .sort((a, b) => b.length - a.length);

  const entities: Entity[] = [];
  for (const draft of drafts) {
    let id = draft.kind === 'total' ? TOTAL_ENTITY_ID : slugify(draft.label);
    if (!id || usedIds.has(id)) id = `${id ? `${id}-` : ''}${slugify(draft.code) || 'x'}`;
    usedIds.add(id);
    idByCode.set(draft.code, id);
    entities.push({ id, label: draft.label, kind: draft.kind });
  }

  // Second pass: attach models and groups to their make. The source lists a make's total row
  // followed by its models, so row order is the main signal. A label-prefix search over all makes
  // covers rows that are out of order.
  const makeIdByLabel = new Map(
    entities.filter((e) => e.kind === 'make').map((e) => [e.label.toUpperCase(), e.id]),
  );
  let current: { label: string; id: string } | undefined;
  for (const entity of entities) {
    if (entity.kind === 'make') {
      current = { label: entity.label.toUpperCase(), id: entity.id };
      continue;
    }
    if (entity.kind !== 'model' && entity.kind !== 'group') continue;
    const upper = entity.label.toUpperCase();
    if (current && upper.startsWith(current.label)) {
      entity.makeId = current.id;
      continue;
    }
    const make = makes.find((m) => upper === m || upper.startsWith(`${m} `));
    const makeId = make ? makeIdByLabel.get(make) : undefined;
    if (makeId) entity.makeId = makeId;
  }

  return { entities, idByCode };
}

export const NATIONAL_AREA_CODE = 'MA1';

/**
 * Maps a source area code to a canonical area. Municipalities are `KU` plus a three-digit number.
 * The source also has rows for cars registered abroad and for unknown places. The national row
 * returns `null` because it is the sum of the others.
 */
export function areaFromCode(code: string, name: string): Area | null {
  if (code === NATIONAL_AREA_CODE) return null;
  const municipality = /^KU(\d{3})$/.exec(code);
  if (municipality)
    return { id: municipality[1] as string, name: name.trim(), kind: 'municipality' };
  if (code === '200') return { id: 'abroad', name: name.trim(), kind: 'abroad' };
  if (code === 'X') return { id: 'unknown', name: name.trim(), kind: 'unknown' };
  throw new Error(`Unrecognised area code in source: ${code}`);
}

/** Fails on a fuel class of a stock table that has no group yet, so it is never dropped silently. */
export function assertKnownStockFuels(codes: readonly string[]): void {
  const unknown = codes.filter((c) => c !== FUEL_TOTAL_CODE && !(c in STOCK_FUEL_GROUP_MAP));
  if (unknown.length > 0) throw new Error(`Unmapped fuel codes in source: ${unknown.join(', ')}`);
}
