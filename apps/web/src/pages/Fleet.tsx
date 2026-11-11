import type { CarFleet } from '@regs/core';
import { useMemo, useState } from 'react';
import { ShareValue } from '../components/ShareValue';
import { SourceCredit } from '../components/SourceCredit';
import { StockSection } from '../components/StockSection';
import {
  Facts,
  PageHeader,
  Section,
  Segmented,
  Skeleton,
  StatusPanel,
  usePageTitle,
} from '../components/ui';
import { useFleet } from '../data/fleet';
import { useGeo, type Geo } from '../data/geo';
import { hasFailed } from '../data/remote';
import { useI18n } from '../i18n';
import {
  fleetAreaRows,
  fleetMakeRows,
  fleetSummary,
  MIN_MAKE_CARS,
  MIN_MUNICIPALITY_CARS,
  otherRows,
  type ElectricShare,
} from '../lib/fleet';
import { FleetAreaTable } from './fleet/FleetAreaTable';
import { FleetMakeTable } from './fleet/FleetMakeTable';
import { FleetMap } from './fleet/FleetMap';

/** The cars in traffic on one day: where the electric ones are, and which makes and ages there are. */
export function Fleet() {
  const { t } = useI18n();
  const fleet = useFleet();
  const geo = useGeo();
  usePageTitle(`${t('fleet.title')} – ${t('app.title')}`);

  if (fleet.status === 'unavailable') {
    return (
      <>
        <PageHeader title={t('fleet.title')} />
        <StatusPanel title={t('fleet.unavailable')} hint={t('fleet.unavailableHint')} />
      </>
    );
  }
  // The map files ship with the site, so even a 404 for them is an error.
  if (fleet.status === 'error' || hasFailed(geo)) {
    return (
      <>
        <PageHeader title={t('fleet.title')} />
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      </>
    );
  }
  if (fleet.status === 'loading' || geo.status !== 'ready') {
    return (
      <>
        <PageHeader title={t('fleet.title')} />
        <div className="loading" role="status" aria-label={t('status.loading')}>
          <Skeleton height={72} />
          <Skeleton height={420} />
        </div>
      </>
    );
  }
  return <FleetContent fleet={fleet.data} geo={geo.data} />;
}

function FleetContent({ fleet, geo }: { fleet: CarFleet; geo: Geo }) {
  const { t, fmt } = useI18n();
  const [kind, setKind] = useState<ElectricShare>('bev');
  const date = fmt.date(fleet.date);
  const summary = useMemo(() => fleetSummary(fleet), [fleet]);
  const areaRows = useMemo(() => fleetAreaRows(fleet), [fleet]);
  const makeRows = useMemo(() => fleetMakeRows(fleet), [fleet]);
  const others = useMemo(() => otherRows(fleet), [fleet]);
  const mapTitle = t('fleet.map.title', { date });

  return (
    <>
      <PageHeader title={t('fleet.title')} lede={t('fleet.lede', { date })} />
      <Facts
        items={[
          { label: t('fleet.cars'), value: fmt.int(summary.cars) },
          { label: t('fleet.bevShare'), value: <ShareValue share={summary.bevShare} /> },
          {
            label: t('fleet.meanAge'),
            value:
              summary.meanAge === null
                ? '–'
                : t('fleet.years', { n: fmt.decimal(summary.meanAge) }),
          },
        ]}
      />

      <Section
        id="fleet-map"
        title={mapTitle}
        tools={
          <Segmented
            label={t('fleet.metric')}
            value={kind}
            options={[
              { value: 'bev', label: t('chart.bevLine') },
              { value: 'plug', label: t('chart.plugLine') },
            ]}
            onChange={setKind}
          />
        }
        footnote={t('fleet.map.note', { min: fmt.int(MIN_MUNICIPALITY_CARS) })}
      >
        <FleetMap rows={areaRows} kind={kind} geo={geo} title={mapTitle} />
      </Section>

      <Section id="fleet-areas" title={t('fleet.areas.title')}>
        <FleetAreaTable rows={areaRows} />
      </Section>

      <Section
        id="fleet-makes"
        title={t('fleet.makes.title')}
        footnote={
          <>
            {t('fleet.makes.note', {
              min: fmt.int(MIN_MAKE_CARS),
              motorhomes: fmt.int(others.motorhomes),
              others: fmt.int(others.others),
            })}{' '}
            <SourceCredit source={fleet.source} message="fleet.source" />
          </>
        }
      >
        <FleetMakeTable rows={makeRows} />
      </Section>

      <StockSection />
    </>
  );
}
