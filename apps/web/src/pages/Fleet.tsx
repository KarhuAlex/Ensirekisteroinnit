import type { CarFleet } from '@regs/core';
import { useMemo } from 'react';
import { ShareValue } from '../components/ShareValue';
import { SourceCredit } from '../components/SourceCredit';
import { StockSection } from '../components/StockSection';
import { Facts, PageHeader, Section, Skeleton, StatusPanel, usePageTitle } from '../components/ui';
import { useFleet } from '../data/fleet';
import { useGeo, type Geo } from '../data/geo';
import { hasFailed } from '../data/remote';
import { useI18n } from '../i18n';
import { fleetMakeRows, fleetSummary, MIN_MAKE_CARS, otherRows } from '../lib/fleet';
import { FleetAreas } from './fleet/FleetAreas';
import { FleetMakeTable } from './fleet/FleetMakeTable';

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
  const date = fmt.date(fleet.date);
  const summary = useMemo(() => fleetSummary(fleet), [fleet]);
  const makeRows = useMemo(() => fleetMakeRows(fleet), [fleet]);
  const others = useMemo(() => otherRows(fleet), [fleet]);

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

      <FleetAreas fleet={fleet} geo={geo} />

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
