import type { FuelPrices } from '@regs/core';
import { useMemo } from 'react';
import { usePrices } from '../data/prices';
import { useI18n } from '../i18n';
import { focusIndex, useTimeline } from '../lib/hooks';
import { alignToMonths, lastPricedIndex } from '../lib/prices';
import { PriceChart } from './PriceChart';
import { RangeControl } from './RangeControl';
import { RollingChart } from './RollingChart';
import { SourceCredit } from './SourceCredit';
import { Section, StatusPanel } from './ui';

const PANEL_HEIGHT = 240;

interface Props {
  /** The months of the registrations; the price series are laid on the same months. */
  months: string[];
  bev: (number | null)[];
  plugIn: (number | null)[];
}

/** Fuel prices above the share of electric cars, on one time axis. Nothing shows until published. */
export function FuelPriceSection({ months, bev, plugIn }: Props) {
  const { t } = useI18n();
  const prices = usePrices();

  if (prices.status === 'error') {
    return <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />;
  }
  if (prices.status !== 'ready') return null;
  return <PricePanels prices={prices.data} months={months} bev={bev} plugIn={plugIn} />;
}

function PricePanels({ prices, months, bev, plugIn }: Props & { prices: FuelPrices }) {
  const { t, fmt } = useI18n();
  const { petrol, diesel } = useMemo(
    () => ({
      petrol: alignToMonths(months, prices.months, prices.series.petrol),
      diesel: alignToMonths(months, prices.months, prices.series.diesel),
    }),
    [months, prices],
  );
  // Prices come from another source and can end before the registrations do.
  const timeline = useTimeline(lastPricedIndex(petrol, diesel));
  const index = focusIndex(timeline, months.length);
  const month = fmt.month(months[index] ?? '');

  return (
    <Section
      id="prices-title"
      title={t('prices.title')}
      tools={<RangeControl value={timeline.range} onChange={timeline.setRange} />}
      footnote={
        <>
          {t('prices.note')} <SourceCredit source={prices.source} message="prices.source" />
        </>
      }
    >
      <p className="readout-head">
        <strong>{timeline.hover === null ? t('prices.latest', { month }) : month}</strong>
      </p>
      <div className="price-panels">
        <section aria-labelledby="prices-price">
          <h3 id="prices-price" className="panel-title">
            {t('prices.panelPrice')}
          </h3>
          <PriceChart
            months={months}
            petrol={petrol}
            diesel={diesel}
            timeline={timeline}
            height={PANEL_HEIGHT}
            ariaLabel={t('prices.aria')}
          />
        </section>
        <section aria-labelledby="prices-share">
          <h3 id="prices-share" className="panel-title">
            {t('chart.electrifiedTitle')}
          </h3>
          <RollingChart
            months={months}
            bev={bev}
            plugIn={plugIn}
            height={PANEL_HEIGHT}
            ariaLabel={t('chart.electrifiedTitle')}
            timeline={timeline}
          />
        </section>
      </div>
    </Section>
  );
}
