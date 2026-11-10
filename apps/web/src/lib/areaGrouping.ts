import type { Area } from '@regs/core';
import type { AreaGroup } from './regionalRanking';
import type { AreaLevel } from './reviewState';

export interface RegionMapping {
  regionOfMunicipality: ReadonlyMap<string, string>;
  regionName: ReadonlyMap<string, string>;
}

/**
 * Where each area goes in the result. Municipalities join their region when the level is regions.
 * A municipality the boundary data does not know goes with the areas of unknown place, so it is
 * never shown as a region of its own.
 */
export function areaGroupOf(level: AreaLevel, mapping: RegionMapping): (area: Area) => AreaGroup {
  return (area) => {
    if (level === 'municipality' || area.kind !== 'municipality') {
      return { id: area.id, name: area.name, kind: area.kind };
    }
    const region = mapping.regionOfMunicipality.get(area.id);
    if (!region) return { id: 'unknown', name: area.name, kind: 'unknown' };
    return { id: region, name: mapping.regionName.get(region) ?? region, kind: 'region' };
  };
}
