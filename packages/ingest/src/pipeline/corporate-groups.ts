import type { Dataset, Entity, Observation } from '@regs/core';
import type { CorporateGroupMapping } from '../config/corporate-groups.js';
import type { Logger } from '../logger.js';

const ID_PREFIX = 'cg-';
const RECENT_MONTHS = 12;

/**
 * Adds a corporate group entity for each group in the mapping, counting the registrations of its
 * makes. Everything after this treats a group like any other entity. A make is in at most one
 * group, and a group id may not collide with an existing entity.
 */
export function withCorporateGroups(dataset: Dataset, mapping: CorporateGroupMapping): Dataset {
  const makeIds = idsOfMakes(dataset);
  const takenIds = new Set(dataset.entities.map((e) => e.id));

  const groups: Entity[] = mapping.groups
    .filter((g) => g.makes.some((make) => makeIds.has(make)))
    .map((g) => ({ id: ID_PREFIX + g.id, label: g.label, kind: 'corporategroup' }));
  for (const group of groups) {
    if (takenIds.has(group.id))
      throw new Error(`Corporate group id "${group.id}" is already in use`);
  }

  return {
    ...dataset,
    entities: [...dataset.entities, ...groups],
    observations: [
      ...dataset.observations,
      ...sumByGroup(dataset.observations, indexByMake(mapping)),
    ],
  };
}

const idsOfMakes = (dataset: Dataset): Set<string> =>
  new Set(dataset.entities.filter((e) => e.kind === 'make').map((e) => e.id));

function indexByMake(mapping: CorporateGroupMapping): Map<string, string> {
  const groupOfMake = new Map<string, string>();
  for (const group of mapping.groups) {
    for (const make of group.makes) {
      const other = groupOfMake.get(make);
      if (other) throw new Error(`Make "${make}" is in both "${other}" and "${group.id}"`);
      groupOfMake.set(make, group.id);
    }
  }
  return groupOfMake;
}

/** The observations of every make in a group, added together by month and fuel. */
function sumByGroup(
  observations: readonly Observation[],
  groupOfMake: ReadonlyMap<string, string>,
): Observation[] {
  const sums = new Map<string, Observation>();
  for (const o of observations) {
    const group = groupOfMake.get(o.entityId);
    if (!group) continue;
    const entityId = ID_PREFIX + group;
    const key = `${entityId}|${o.period}|${o.fuel}`;
    const sum = sums.get(key);
    if (sum) sum.count += o.count;
    else sums.set(key, { ...o, entityId });
  }
  return [...sums.values()];
}

interface Coverage {
  /** Share (0 to 1) of the recent registrations that belong to a group; `null` without any. */
  share: number | null;
  /** Makes that sold cars recently, are in no group and are not ignored, with their counts. */
  missing: Map<string, number>;
}

function measureCoverage(dataset: Dataset, mapping: CorporateGroupMapping): Coverage {
  const makeIds = idsOfMakes(dataset);
  const groupOfMake = indexByMake(mapping);
  const ignored = new Set(mapping.ignored);
  const periods = [...new Set(dataset.observations.map((o) => o.period))].sort();
  const recent = new Set(periods.slice(-RECENT_MONTHS));

  let covered = 0;
  let all = 0;
  const missing = new Map<string, number>();
  for (const o of dataset.observations) {
    if (!recent.has(o.period) || !makeIds.has(o.entityId)) continue;
    all += o.count;
    if (groupOfMake.has(o.entityId)) covered += o.count;
    else if (!ignored.has(o.entityId)) {
      missing.set(o.entityId, (missing.get(o.entityId) ?? 0) + o.count);
    }
  }
  return { share: all > 0 ? covered / all : null, missing };
}

/**
 * Checks that the mapping still covers the makes that sell cars. Makes that are missing are
 * logged, and a coverage below `minCoverage` (0 to 1) stops the run, so a renamed make cannot
 * quietly take a group's history with it.
 */
export function reportCorporateGroups(
  dataset: Dataset,
  mapping: CorporateGroupMapping,
  log: Logger,
  minCoverage?: number,
): void {
  const { share, missing } = measureCoverage(dataset, mapping);
  if (share === null) return;

  log.info(`Corporate groups cover ${(share * 100).toFixed(1)} % of the last 12 months`);
  if (missing.size > 0) {
    const list = [...missing].map(([id, count]) => `${id} (${count})`).join(', ');
    log.warn(`Makes not in the corporate group mapping, last 12 months: ${list}`);
  }
  if (minCoverage !== undefined && share < minCoverage) {
    throw new Error(
      `Corporate groups cover only ${(share * 100).toFixed(1)} % of the last 12 months ` +
        `(expected at least ${(minCoverage * 100).toFixed(0)} %); update the mapping`,
    );
  }
}
