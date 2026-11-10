import type { Observation, Period } from '@regs/core';
import type { ObjectStore } from '../../storage/types.js';

export interface AreaCache {
  sourceVersion: string;
  fromYear: number;
  throughMonth: Period;
  observations: Observation[];
}

/** One file per area, so an interrupted run resumes and later runs fetch only the new months. */
export class AreaCacheStore {
  constructor(private readonly store: ObjectStore) {}

  async read(areaCode: string): Promise<AreaCache | null> {
    const text = await this.store.get(pathOf(areaCode));
    if (!text) return null;
    try {
      return JSON.parse(text) as AreaCache;
    } catch {
      return null;
    }
  }

  write(areaCode: string, value: AreaCache): Promise<void> {
    return this.store.put(pathOf(areaCode), JSON.stringify(value));
  }
}

const pathOf = (areaCode: string): string => `areas/${areaCode}.json`;
