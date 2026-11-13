import type { CarFleet, FleetCell } from '@regs/core';
import { useMemo } from 'react';
import { Skeleton } from '../../components/ui';
import type { Remote } from '../../data/remote';
import type { RegionMapping } from '../../lib/areaGrouping';
import { fleetAreaMakeRows } from '../../lib/fleetMakes';
import { useI18n } from '../../i18n';
import type { AreaLevel } from '../../lib/reviewState';

interface Props {
  fleet: CarFleet;
  mapping: RegionMapping;
  level: AreaLevel;
  area: { id: string; name: string };
  /** The cars of every make in every municipality, while they are loading or once they are here. */
  cells: Remote<readonly FleetCell[]>;
}

/** The makes with the most cars in the chosen area, under its figures. */
export function FleetAreaMakes({ fleet, mapping, level, area, cells }: Props) {
  const { t, fmt } = useI18n();
  const all = cells.status === 'ready' ? cells.data : null;
  const rows = useMemo(
    () => (all ? fleetAreaMakeRows(fleet, all, area.id, level, mapping) : []),
    [fleet, all, area.id, level, mapping],
  );

  // About as tall as the table, so that the page below does not jump when it arrives.
  if (cells.status === 'loading') return <Skeleton height={320} />;
  if (cells.status !== 'ready') return <p className="muted">{t('fleet.areaMakes.unavailable')}</p>;
  if (rows.length === 0) return null;
  const caption = t('fleet.areaMakes.title', { name: area.name });
  return (
    <div>
      <h4 className="panel-title">{caption}</h4>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{t('fleet.make')}</th>
              <th scope="col" className="num">
                {t('fleet.col.cars')}
              </th>
              <th scope="col" className="num">
                {t('fleet.col.areaShare')}
              </th>
              <th scope="col" className="num">
                {t('fleet.col.bevOfMake')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="num">{fmt.int(row.cars)}</td>
                <td className="num">{fmt.pct(row.share)}</td>
                <td className="num">{fmt.pct(row.bevShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
