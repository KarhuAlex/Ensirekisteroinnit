import { FUEL_GROUP_IDS, FUEL_GROUP_OF, type FuelGroupId, type FuelId } from './fuels.js';
import type { EntitySeries } from './types.js';

export type GroupedSeries = Record<FuelGroupId, number[]>;

function sumArrays(arrays: readonly (readonly number[])[], length: number): number[] {
  const out = new Array<number>(length).fill(0);
  for (const arr of arrays) {
    for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) + (arr[i] ?? 0);
  }
  return out;
}

export function groupSeries(entity: Pick<EntitySeries, 'series'>, length: number): GroupedSeries {
  const grouped = Object.fromEntries(
    FUEL_GROUP_IDS.map((g) => [g, new Array<number>(length).fill(0)]),
  ) as GroupedSeries;
  for (const [fuel, values] of Object.entries(entity.series) as [FuelId, number[]][]) {
    const target = grouped[FUEL_GROUP_OF[fuel]];
    for (let i = 0; i < length; i++) target[i] = (target[i] ?? 0) + (values[i] ?? 0);
  }
  return grouped;
}

export function totalSeries(grouped: GroupedSeries, length: number): number[] {
  return sumArrays(Object.values(grouped), length);
}
