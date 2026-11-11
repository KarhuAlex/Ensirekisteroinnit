import { useMemo } from 'react';
import { AreaTable } from '../../components/AreaTable';
import { Skeleton, StatusPanel } from '../../components/ui';
import { useCatalog } from '../../data/DataProvider';
import { useGeo, type Geo } from '../../data/geo';
import { useRegional } from '../../data/regional';
import { hasFailed } from '../../data/remote';
import { useI18n } from '../../i18n';
import { areaGroupOf } from '../../lib/areaGrouping';
import { effectiveMetric, isUnnarrowed } from '../../lib/areaMetrics';
import { comparisonRange } from '../../lib/ranking';
import { clampToStart, spanOf, yearsOfSpans } from '../../lib/regionalPeriods';
import { MIN_AREA_BASE, rankAreas, type RegionalView } from '../../lib/regionalRanking';
import type { ReviewState } from '../../lib/reviewState';
import { AreaFacts } from './AreaFacts';
import { AreaMapSection } from './AreaMapSection';
import { toTableRows } from './areaTableRows';

interface Props {
  state: ReviewState;
  months: readonly string[];
  periodLabel: string;
  fileStem: string;
}

export function AreaView({ state, months, periodLabel, fileStem }: Props) {
  const { t } = useI18n();
  const mainSpan = spanOf(months, state.range);
  const compareRange = comparisonRange(state.range, state.compare, months.length);
  const compareSpan = compareRange ? spanOf(months, compareRange) : null;
  const regional = useRegional(yearsOfSpans(mainSpan, compareSpan));
  const geo = useGeo();

  if (regional.status === 'unavailable') {
    return (
      <StatusPanel
        title={t('review.regional.unavailable')}
        hint={t('review.regional.unavailableHint')}
      />
    );
  }
  // The map files ship with the site, so even a 404 for them is an error.
  if (regional.status === 'error' || hasFailed(geo)) {
    return <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />;
  }
  if (regional.status === 'loading' || geo.status !== 'ready') {
    return (
      <div className="loading" role="status" aria-label={t('status.loading')}>
        <Skeleton height={72} />
        <Skeleton height={420} />
      </div>
    );
  }
  return (
    <AreaResults
      view={regional.data}
      geo={geo.data}
      state={state}
      mainSpan={mainSpan}
      compareSpan={compareSpan}
      periodLabel={periodLabel}
      fileStem={fileStem}
    />
  );
}

interface ResultsProps {
  view: RegionalView;
  geo: Geo;
  state: ReviewState;
  mainSpan: { from: string; to: string };
  compareSpan: { from: string; to: string } | null;
  periodLabel: string;
  fileStem: string;
}

function AreaResults({
  view,
  geo,
  state,
  mainSpan,
  compareSpan,
  periodLabel,
  fileStem,
}: ResultsProps) {
  const { t } = useI18n();
  const { byId } = useCatalog();
  const firstPeriod = view.index.months[0] as string;
  const period = clampToStart(mainSpan, firstPeriod);
  const compare = compareSpan && compareSpan.from >= firstPeriod ? compareSpan : null;
  const entityId = state.entity && byId.has(state.entity) ? state.entity : null;
  const metric = effectiveMetric(state);

  const ranking = useMemo(
    () =>
      period
        ? rankAreas(
            view,
            { period, fuels: state.fuels, entityId, compare },
            areaGroupOf(state.areaLevel, geo),
          )
        : null,
    [view, period, state.fuels, entityId, compare, state.areaLevel, geo],
  );
  const rows = useMemo(() => toTableRows(ranking?.rows ?? [], geo, t), [ranking, geo, t]);

  if (!period || !ranking) {
    return (
      <StatusPanel
        title={t('review.regional.before', { year: firstPeriod.slice(0, 4) })}
        hint={t('review.regional.beforeHint')}
      />
    );
  }
  if (ranking.national.total === 0) {
    return <StatusPanel title={t('review.empty')} hint={t('review.emptyHint')} />;
  }

  return (
    <>
      <AreaFacts national={ranking.national} rows={rows} metric={metric} />
      {period.from !== mainSpan.from && (
        <p className="footnote">
          {t('review.regional.clamped', { year: firstPeriod.slice(0, 4) })}
        </p>
      )}
      {state.compare !== 'none' && !compare && (
        <p className="footnote">{t('review.compareUnavailable')}</p>
      )}
      <AreaMapSection
        rows={rows}
        metric={metric}
        areaLevel={state.areaLevel}
        geo={geo}
        periodLabel={periodLabel}
      />
      {isUnnarrowed(state) && <p className="footnote">{t('review.area.narrow')}</p>}
      <AreaTable
        rows={rows}
        metric={metric}
        showChange={compare !== null}
        showRegion={state.areaLevel === 'municipality'}
        caption={t('review.caption.area', { period: periodLabel })}
        period={fileStem}
      />
      <p className="footnote">{t('review.area.note', { min: MIN_AREA_BASE })}</p>
    </>
  );
}
