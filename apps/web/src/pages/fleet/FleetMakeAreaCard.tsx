import { Facts } from '../../components/ui';
import { useI18n } from '../../i18n';
import { MIN_MUNICIPALITY_CARS } from '../../lib/fleet';
import type { FleetMakeAreaRow } from '../../lib/fleetMakes';
import { AreaCardFrame } from './AreaCardFrame';

interface Props {
  row: FleetMakeAreaRow | null;
  makeName: string;
  /** Where the area comes in order of the share; `null` where the area has too few cars. */
  rank: { rank: number; of: number } | null;
}

/** The chosen area's cars of the make, under the map. */
export function FleetMakeAreaCard({ row, makeName, rank }: Props) {
  return (
    <AreaCardFrame>
      {row && <MakeAreaFigures row={row} makeName={makeName} rank={rank} />}
    </AreaCardFrame>
  );
}

function MakeAreaFigures({ row, makeName, rank }: Props & { row: FleetMakeAreaRow }) {
  const { t, fmt } = useI18n();
  const share = fmt.pct(row.share);
  return (
    <section aria-label={t('fleet.card.label', { name: row.name })}>
      <h3 className="panel-title">{row.name}</h3>
      <Facts
        items={[
          { label: t('fleet.card.makeCars', { make: makeName }), value: fmt.int(row.makeCars) },
          {
            label: t('fleet.col.areaShare'),
            value: row.reliable ? share : <span className="muted">{share}</span>,
            ...(rank ? { note: t('fleet.card.rank', { rank: rank.rank, of: rank.of }) } : {}),
          },
          { label: t('fleet.card.areaCars'), value: fmt.int(row.cars) },
        ]}
      />
      {!row.reliable && (
        <p className="footnote">
          {t('fleet.col.unreliable', { min: fmt.int(MIN_MUNICIPALITY_CARS) })}
        </p>
      )}
    </section>
  );
}
