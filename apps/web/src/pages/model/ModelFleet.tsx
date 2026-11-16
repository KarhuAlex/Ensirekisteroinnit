import { type EntityKind } from '@regs/core';
import { Link } from 'react-router-dom';
import { SourceCredit } from '../../components/SourceCredit';
import { Facts, Section } from '../../components/ui';
import { useFleet } from '../../data/fleet';
import { useI18n } from '../../i18n';
import { modelFleetView } from '../../lib/fleet';

interface Props {
  entity: { id: string; kind: EntityKind; makeId?: string };
  /** The name the page shows for the entity. */
  name: string;
  /** First registrations of the entity over the whole period of the data. */
  registered: number;
  /** The first month of the data, from which `registered` counts. */
  since: string;
}

/**
 * The cars in traffic on the day of the fleet snapshot, which the fleet knows by make only: a make
 * gets them beside the first registrations that the rest of the page is about, and a model is told
 * where to find its make's. Nothing is shown, and nothing is reserved, until the fleet is here and
 * has the make.
 */
export function ModelFleet({ entity, name, registered, since }: Props) {
  const { t, fmt, lang } = useI18n();
  const fleet = useFleet();
  if (fleet.status !== 'ready') return null;
  const view = modelFleetView(fleet.data, entity);
  if (!view) return null;
  const { row } = view;

  if (view.kind === 'note') {
    return (
      <p className="footnote">
        {t('model.fleet.onlyMakes')} <Link to={`/${lang}/models/${row.id}`}>{row.name}</Link>.
      </p>
    );
  }
  const items = [
    { label: t('model.fleet.cars'), value: fmt.int(row.cars) },
    { label: t('model.fleet.share'), value: fmt.pct(row.fleetShare) },
    ...(row.meanAge === null
      ? []
      : [{ label: t('fleet.meanAge'), value: t('fleet.years', { n: fmt.decimal(row.meanAge) }) }]),
  ];
  return (
    <Section
      id="model-fleet"
      title={t('model.fleet.title')}
      lede={t('model.fleet.lede', { name, date: fmt.date(fleet.data.date) })}
      footnote={
        <>
          {t('model.fleet.note')} <SourceCredit source={fleet.data.source} message="fleet.source" />
        </>
      }
    >
      <Facts items={items} />
      <p>
        {t('model.fleet.compare', {
          since: since.slice(0, 4),
          registered: fmt.int(registered),
          cars: fmt.int(row.cars),
        })}
      </p>
      <p>
        <Link to={`/${lang}/stock?make=${encodeURIComponent(row.id)}`}>
          {t('model.fleet.link')}
        </Link>
      </p>
    </Section>
  );
}
