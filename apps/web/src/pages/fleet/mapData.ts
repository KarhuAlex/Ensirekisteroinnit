import type { useI18n } from '../../i18n';
import type { MapDatum } from '../../lib/charts';
import { MIN_MUNICIPALITY_CARS, type ElectricShare, type FleetAreaRow } from '../../lib/fleet';
import type { FleetMakeAreaRow } from '../../lib/fleetMakes';

type I18n = ReturnType<typeof useI18n>;

/** A share shown as it is, or as the reason it should not be trusted. */
const shownShare = ({ t, fmt }: I18n, reliable: boolean, share: number | null): string =>
  reliable ? fmt.pct(share) : t('fleet.col.unreliable', { min: fmt.int(MIN_MUNICIPALITY_CARS) });

/** What the map shows for each area while no make is chosen: the electric share of its cars. */
export function electricShareData(
  rows: readonly FleetAreaRow[],
  kind: ElectricShare,
  i18n: I18n,
): MapDatum[] {
  const { t, fmt } = i18n;
  const label = t(kind === 'bev' ? 'chart.bevLine' : 'chart.plugLine');
  return rows.map((row) => {
    const share = kind === 'bev' ? row.bevShare : row.plugShare;
    return {
      id: row.id,
      value: row.reliable ? share : null,
      tooltip: [
        row.name,
        `${label}: ${shownShare(i18n, row.reliable, share)}`,
        `${t('fleet.col.cars')}: ${fmt.int(row.cars)}`,
      ],
    };
  });
}

/** What the map shows for each area while a make is chosen: its share of the cars of the area. */
export function makeShareData(
  rows: readonly FleetMakeAreaRow[],
  makeName: string,
  i18n: I18n,
): MapDatum[] {
  const { t, fmt } = i18n;
  return rows.map((row) => ({
    id: row.id,
    value: row.reliable ? row.share : null,
    tooltip: [
      row.name,
      `${makeName}: ${fmt.int(row.makeCars)}`,
      `${t('fleet.col.areaShare')}: ${shownShare(i18n, row.reliable, row.share)}`,
    ],
  }));
}
