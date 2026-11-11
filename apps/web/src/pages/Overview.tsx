import { TOTAL_ENTITY_ID } from '@regs/core';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BevHero } from '../components/BevHero';
import { FuelChart } from '../components/FuelChart';
import { FuelPriceSection } from '../components/FuelPriceSection';
import { RollingChart } from '../components/RollingChart';
import { SearchBox } from '../components/SearchBox';
import { SourceNote } from '../components/SourceNote';
import { StockSection } from '../components/StockSection';
import { Facts, Section, Skeleton, StatusPanel, usePageTitle } from '../components/ui';
import { useCatalog, useEntitySeries } from '../data/DataProvider';
import { dataOf, hasFailed } from '../data/remote';
import { useStock } from '../data/stock';
import { useTimeAxis } from '../data/useTimeAxis';
import { useI18n } from '../i18n';
import { summarizeElectrification } from '../lib/electrification';
import { buildSeriesView } from '../lib/seriesView';
import { latestStock } from '../lib/stock';
import { toneOf } from '../lib/stats';

export function Overview() {
  const { lang, t, fmt } = useI18n();
  const { manifest } = useCatalog();
  const seriesState = useEntitySeries(TOTAL_ENTITY_ID);
  const series = dataOf(seriesState);
  const failed = hasFailed(seriesState);
  usePageTitle(t('app.title'));

  const axis = useTimeAxis();
  const stockState = useStock();
  const carStock = dataOf(stockState);
  const latestCarStock = useMemo(() => (carStock ? latestStock(carStock) : null), [carStock]);

  const view = useMemo(() => {
    if (!series) return null;
    const seriesView = buildSeriesView(series, manifest.months);
    return {
      ...seriesView,
      ...summarizeElectrification(seriesView.grouped, seriesView.totals),
    };
  }, [series, manifest.months]);

  const yearCategories = useMemo(
    () => (view ? axis.yearLabels(view.annual.years) : []),
    [view, axis],
  );

  const monthLabel = axis.latestMonthLabel;
  const pp = ` ${t('unit.pp')}`;

  return (
    <>
      <div className="hero">
        <SearchBox variant="hero" />
      </div>

      {(failed || !view) && <h1 className="sr-only">{t('app.title')}</h1>}
      {failed ? (
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      ) : !view ? (
        <div className="loading" role="status" aria-label={t('status.loading')}>
          <Skeleton height={64} />
          <Skeleton height={72} />
          <Skeleton height={420} />
        </div>
      ) : (
        <>
          <BevHero
            summary={view}
            month={monthLabel}
            stock={latestCarStock}
            stockPending={stockState.status === 'loading'}
          />

          <Section
            id="share-title"
            title={t('chart.shareTitle')}
            hideTitle
            footnote={
              <>
                <SourceNote extra={t('status.partial', { month: monthLabel })} />{' '}
                <Link to={`/${lang}/table`}>{t('chart.asTable')}</Link>
              </>
            }
          >
            <FuelChart
              categories={manifest.months}
              labels={axis.monthLabels}
              grouped={view.grouped}
              monthly
              shape="area"
              initialMode="share"
              switchableMode
              withRanges
              height={340}
              ariaLabel={t('chart.aria.share')}
            />
          </Section>
          <Facts
            items={[
              {
                label: t('kpi.registrations', { month: monthLabel }),
                value: fmt.int(view.regsNow),
                note: t('kpi.vsYear', { value: fmt.signed(view.regsDelta, ' %') }),
                tone: toneOf(view.regsDelta),
              },
              {
                label: t('kpi.bevShare', { month: monthLabel }),
                value: fmt.pct(view.bevNow),
                note: t('kpi.vsYear', { value: fmt.signed(view.bevDelta, pp) }),
                tone: toneOf(view.bevDelta),
              },
              {
                label: t('kpi.bevShare12'),
                value: fmt.pct(view.bev12),
                note: t('kpi.vsYear', { value: fmt.signed(view.bev12Delta, pp) }),
                tone: toneOf(view.bev12Delta),
              },
              {
                label: t('kpi.plugShare12'),
                value: fmt.pct(view.plug12),
                note: t('kpi.vsYear', { value: fmt.signed(view.plug12Delta, pp) }),
                tone: toneOf(view.plug12Delta),
              },
            ]}
          />

          <div className="two-up">
            <Section
              id="annual-title"
              title={t('chart.annualTitle')}
              footnote={
                axis.incompleteYear ? t('chart.partialYear', { month: monthLabel }) : undefined
              }
            >
              <FuelChart
                categories={yearCategories}
                labels={yearCategories}
                grouped={view.annual.grouped}
                monthly={false}
                initialMode="share"
                switchableMode
                withRanges={false}
                height={340}
                ariaLabel={t('chart.annualTitle')}
              />
            </Section>
            <Section id="rolling-title" title={t('chart.electrifiedTitle')}>
              <RollingChart
                months={manifest.months}
                bev={view.bevSeries}
                plugIn={view.plugSeries}
                height={340}
                ariaLabel={t('chart.electrifiedTitle')}
              />
            </Section>
          </div>

          <StockSection />
          <FuelPriceSection
            months={manifest.months}
            bev={view.bevSeries}
            plugIn={view.plugSeries}
          />
        </>
      )}
    </>
  );
}
