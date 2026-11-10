import {
  FUEL_GROUP_IDS,
  FUEL_GROUP_OF,
  REGIONAL_FORMAT,
  SCHEMA_VERSION,
  TOTAL_ENTITY_ID,
  type Period,
  type RegionalDataset,
  type RegionalIndex,
  type RegionalYear,
} from '@regs/core';
import type { SourceAdapter } from '../adapters/types.js';
import type { Pipeline, PublishableRelease } from './pipeline.js';
import { releaseIdFor } from './release.js';

const MIN_AREAS = 200;

/** A failed check aborts the run, so the previous release keeps being served. */
export function validateRegional(dataset: RegionalDataset, minAreas = MIN_AREAS): void {
  const problems: string[] = [];
  if (!dataset.entities.some((e) => e.id === TOTAL_ENTITY_ID)) problems.push('no total entity');
  if (dataset.areas.length < minAreas) {
    problems.push(`only ${dataset.areas.length} areas (expected at least ${minAreas})`);
  }
  if (dataset.areaObservations.every((a) => a.observations.length === 0)) {
    problems.push('no observations');
  }

  const summed = new Map<Period, number>();
  for (const { observations } of dataset.areaObservations) {
    for (const o of observations) {
      if (o.entityId === TOTAL_ENTITY_ID)
        summed.set(o.period, (summed.get(o.period) ?? 0) + o.count);
    }
  }
  const off = Object.entries(dataset.nationalTotals).filter(
    ([period, total]) => (summed.get(period) ?? 0) !== total,
  );
  if (off.length > 0) {
    const sample = off.slice(0, 3).map(([period]) => period);
    problems.push(`areas do not add up to the national total in ${off.length} months (${sample})`);
  }

  if (problems.length > 0)
    throw new Error(`Regional data failed validation: ${problems.join('; ')}`);
}

export function buildRegionalRelease(dataset: RegionalDataset, now: Date): PublishableRelease {
  const months = Object.keys(dataset.nationalTotals).sort();
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const entityIndex = new Map(dataset.entities.map((e, i) => [e.id, i]));
  const areaIndex = new Map(dataset.areas.map((a, i) => [a.id, i]));
  const groups = FUEL_GROUP_IDS.length;

  // Fuels of the same group merge into one cell; the numeric key also gives a stable order.
  const cells = new Map<number, number>();
  for (const { areaId, observations } of dataset.areaObservations) {
    const a = areaIndex.get(areaId);
    if (a === undefined) throw new Error(`Observations refer to an unknown area: ${areaId}`);
    for (const o of observations) {
      const e = entityIndex.get(o.entityId);
      const m = monthIndex.get(o.period);
      if (e === undefined || m === undefined) {
        throw new Error(`Observation refers to an unknown entity or month: ${JSON.stringify(o)}`);
      }
      const g = FUEL_GROUP_IDS.indexOf(FUEL_GROUP_OF[o.fuel]);
      const key = ((e * dataset.areas.length + a) * groups + g) * months.length + m;
      cells.set(key, (cells.get(key) ?? 0) + o.count);
    }
  }

  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const byYear = new Map<string, RegionalYear>(
    years.map((year) => [
      year,
      { schemaVersion: SCHEMA_VERSION, year, cells: { e: [], a: [], g: [], m: [], n: [] } },
    ]),
  );
  for (const key of [...cells.keys()].sort((x, y) => x - y)) {
    const m = key % months.length;
    const rest = Math.floor(key / months.length);
    const g = rest % groups;
    const ea = Math.floor(rest / groups);
    const target = byYear.get((months[m] as string).slice(0, 4))!.cells;
    target.e.push(Math.floor(ea / dataset.areas.length));
    target.a.push(ea % dataset.areas.length);
    target.g.push(g);
    target.m.push(m);
    target.n.push(cells.get(key) as number);
  }

  const id = releaseIdFor(now);
  const generatedAt = now.toISOString();
  const index: RegionalIndex = {
    schemaVersion: SCHEMA_VERSION,
    release: id,
    generatedAt,
    source: {
      name: dataset.sourceName,
      url: dataset.sourceUrl,
      licence: dataset.licence,
      updated: dataset.sourceUpdated,
    },
    months,
    years,
    entities: dataset.entities.map((e) => e.id),
    areas: dataset.areas,
    groups: [...FUEL_GROUP_IDS],
  };

  return {
    id,
    generatedAt,
    files: [
      { path: 'index.json', body: JSON.stringify(index) },
      ...[...byYear.values()].map((year) => ({
        path: `years/${year.year}.json`,
        body: JSON.stringify(year),
      })),
    ],
  };
}

export function regionalPipeline(
  adapter: SourceAdapter<RegionalDataset>,
  minAreas = MIN_AREAS,
): Pipeline<RegionalDataset> {
  return {
    name: 'regional registrations',
    format: REGIONAL_FORMAT,
    adapter,
    validate: (dataset) => validateRegional(dataset, minAreas),
    build: buildRegionalRelease,
    sourceVersionOf: (dataset) => dataset.sourceVersion,
  };
}
