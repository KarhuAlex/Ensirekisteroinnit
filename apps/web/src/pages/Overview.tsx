import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FuelChart } from '../components/FuelChart';
import { RollingChart } from '../components/RollingChart';
import { PopularModels, SearchBox } from '../components/SearchBox';
import { SourceNote } from '../components/SourceNote';
import { Facts, PageHeader, Section, Skeleton, StatusPanel, usePageTitle } from '../components/ui';
import { useCatalog, useEntitySeries } from '../data/DataProvider';
import { useTimeAxis } from '../data/useTimeAxis';
import { useI18n } from '../i18n';
import { summarizeElectrification } from '../lib/electrification';
import { buildSeriesView } from '../lib/seriesView';

function bevStoryKey(delta: number | null): 'story.bevUp' | 'story.bevDown' | 'story.bevFlat' {
  if (delta === null || Math.abs(delta) < 0.05) return 'story.bevFlat';
  return delta > 0 ? 'story.bevUp' : 'story.bevDown';
}

export function Overview() {
  const { lang, t, fmt } = useI18n();
  const { manifest } = useCatalog();
  const { series, error } = useEntitySeries('total');
  usePageTitle(t('app.title'));

  const axis = useTimeAxis();

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
  const tone = (v: number | null) =>
    v === null || v === 0 ? 'neutral' : v > 0 ? 'positive' : 'negative';

  return (
    <>
      <div className="hero">
        <SearchBox variant="hero" />
        <PopularModels />
      </div>

      {error ? (
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      ) : !view ? (
        <div className="loading" role="status" aria-label={t('status.loading')}>
          <Skeleton height={64} />
          <Skeleton height={72} />
          <Skeleton height={420} />
        </div>
      ) : (
        <>
          <PageHeader
            title={t(bevStoryKey(view.bevDelta), {
              share: fmt.pct(view.bevNow),
              delta: `${fmt.decimal(Math.abs(view.bevDelta ?? 0))} ${t('unit.pp')}`,
            })}
            lede={t('story.bevDetail', {
              month: monthLabel,
              share12: fmt.pct(view.bev12),
            })}
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
                tone: tone(view.regsDelta),
              },
              {
                label: t('kpi.bevShare', { month: monthLabel }),
                value: fmt.pct(view.bevNow),
                note: t('kpi.vsYear', { value: fmt.signed(view.bevDelta, pp) }),
                tone: tone(view.bevDelta),
              },
              {
                label: t('kpi.bevShare12'),
                value: fmt.pct(view.bev12),
                note: t('kpi.vsYear', { value: fmt.signed(view.bev12Delta, pp) }),
                tone: tone(view.bev12Delta),
              },
              {
                label: t('kpi.plugShare12'),
                value: fmt.pct(view.plug12),
                note: t('kpi.vsYear', { value: fmt.signed(view.plug12Delta, pp) }),
                tone: tone(view.plug12Delta),
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
        </>
      )}
    </>
  );
}
