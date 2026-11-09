import {
  FUEL_GROUP_IDS,
  FUEL_GROUP_OF,
  FUEL_IDS,
  SCHEMA_VERSION,
  type Dataset,
  type EntitySeries,
  type EntitySummary,
  type FuelId,
  type Manifest,
  type Matrix,
  type MatrixRow,
  type Period,
} from '@regs/core';

export interface ReleaseFile {
  path: string;
  body: string;
}

export interface Release {
  id: string;
  generatedAt: string;
  manifest: Manifest;
  files: ReleaseFile[];
}

/** Every month from `from` to `to` inclusive, so that gaps in the source become explicit zeros. */
export function monthRange(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [endY, endM] = to.split('-').map(Number) as [number, number];
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function releaseIdFor(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
}

export function buildRelease(dataset: Dataset, now: Date = new Date()): Release {
  const periods = dataset.observations.map((o) => o.period).sort();
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (!first || !last) throw new Error('Cannot build a release from an empty dataset');

  const months = monthRange(first, last);
  const monthIndex = new Map(months.map((m, i) => [m, i]));

  const seriesByEntity = new Map<string, Map<FuelId, number[]>>();
  for (const o of dataset.observations) {
    const idx = monthIndex.get(o.period);
    if (idx === undefined) continue;
    let perFuel = seriesByEntity.get(o.entityId);
    if (!perFuel) seriesByEntity.set(o.entityId, (perFuel = new Map()));
    let arr = perFuel.get(o.fuel);
    if (!arr) perFuel.set(o.fuel, (arr = new Array<number>(months.length).fill(0)));
    arr[idx] = (arr[idx] ?? 0) + o.count;
  }

  const files: ReleaseFile[] = [];
  const summaries: EntitySummary[] = [];
  const matrixRows: MatrixRow[] = [];
  const usedFuels = new Set<FuelId>();
  const tailStart = Math.max(0, months.length - 12);

  for (const entity of dataset.entities) {
    const perFuel = seriesByEntity.get(entity.id);
    if (!perFuel) continue;

    const series: EntitySeries['series'] = {};
    let total = 0;
    let last12 = 0;
    let bevLast12 = 0;
    for (const fuel of FUEL_IDS) {
      const arr = perFuel.get(fuel);
      if (!arr) continue;
      series[fuel] = arr;
      usedFuels.add(fuel);
      const tail = arr.slice(tailStart).reduce((a, b) => a + b, 0);
      total += arr.reduce((a, b) => a + b, 0);
      last12 += tail;
      if (fuel === 'bev') bevLast12 += tail;
    }
    if (total === 0) continue;

    const entitySeries: EntitySeries = {
      id: entity.id,
      label: entity.label,
      kind: entity.kind,
      series,
    };
    files.push({ path: `entities/${entity.id}.json`, body: JSON.stringify(entitySeries) });
    summaries.push({ ...entity, total, last12, bevLast12 });
    matrixRows.push(matrixRow(entity.id, perFuel, months.length));
  }

  const generatedAt = now.toISOString();
  const id = releaseIdFor(now);
  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    release: id,
    generatedAt,
    source: {
      id: dataset.sourceId,
      name: dataset.sourceName,
      url: dataset.sourceUrl,
      licence: dataset.licence,
      updated: dataset.sourceUpdated,
    },
    months,
    latestMonth: last,
    fuels: FUEL_IDS.filter((f) => usedFuels.has(f)),
    notes: dataset.notes,
  };

  files.push({ path: 'manifest.json', body: JSON.stringify(manifest) });
  files.push({ path: 'entities.json', body: JSON.stringify(summaries) });
  const matrix: Matrix = {
    schemaVersion: SCHEMA_VERSION,
    months,
    groups: [...FUEL_GROUP_IDS],
    rows: matrixRows,
  };
  files.push({ path: 'matrix.json', body: JSON.stringify(matrix) });

  return { id, generatedAt, manifest, files };
}

function matrixRow(id: string, perFuel: Map<FuelId, number[]>, monthCount: number): MatrixRow {
  const counts = new Array<number>(FUEL_GROUP_IDS.length * monthCount).fill(0);
  for (const [fuel, values] of perFuel) {
    const offset = FUEL_GROUP_IDS.indexOf(FUEL_GROUP_OF[fuel]) * monthCount;
    for (let m = 0; m < monthCount; m++)
      counts[offset + m] = (counts[offset + m] ?? 0) + (values[m] ?? 0);
  }
  return { id, counts };
}
