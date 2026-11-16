import { ShareValue } from '../../components/ShareValue';
import { Facts } from '../../components/ui';
import { useI18n } from '../../i18n';
import { MIN_MUNICIPALITY_CARS, type FleetAreaRow } from '../../lib/fleet';
import { AreaCardFrame } from './AreaCardFrame';

/** The figures of the chosen area, under the map. On a phone this is where a tap on the map lands. */
export function FleetAreaCard({ row }: { row: FleetAreaRow | null }) {
  return <AreaCardFrame>{row && <AreaFigures row={row} />}</AreaCardFrame>;
}

function AreaFigures({ row }: { row: FleetAreaRow }) {
  const { t, fmt } = useI18n();
  // A share of too few cars is shown, but not coloured as if it meant something.
  const share = (value: number | null) =>
    row.reliable ? <ShareValue share={value} /> : <span className="muted">{fmt.pct(value)}</span>;
  return (
    <section aria-label={t('fleet.card.label', { name: row.name })}>
      <h3 className="panel-title">{row.name}</h3>
      <Facts
        items={[
          { label: t('fleet.col.cars'), value: fmt.int(row.cars) },
          { label: t('fleet.col.bevShare'), value: share(row.bevShare) },
          { label: t('fleet.col.plugShare'), value: share(row.plugShare) },
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
