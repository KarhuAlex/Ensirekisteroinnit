import type { RegionMapping } from '../../lib/areaGrouping';
import type { AreaRow } from '../../lib/regionalRanking';
import type { AreaTableRow } from '../../components/AreaTable';
import type { Translate } from './formatMetric';

/** Adds the names the table shows: translated labels for non-municipalities, and the region. */
export function toTableRows(
  rows: readonly AreaRow[],
  mapping: RegionMapping,
  t: Translate,
): AreaTableRow[] {
  return rows.map((row) => ({
    ...row,
    label:
      row.kind === 'abroad' || row.kind === 'unknown' ? t(`review.area.${row.kind}`) : row.name,
    region:
      row.kind === 'municipality'
        ? (mapping.regionName.get(mapping.regionOfMunicipality.get(row.id) ?? '') ?? '')
        : '',
  }));
}
