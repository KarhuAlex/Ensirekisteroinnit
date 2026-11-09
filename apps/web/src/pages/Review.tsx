import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FuelFilter } from '../components/FuelFilter';
import { PeriodPicker } from '../components/PeriodPicker';
import { RankingTable } from '../components/RankingTable';
import {
  Facts,
  PageHeader,
  Segmented,
  Skeleton,
  StatusPanel,
  usePageTitle,
} from '../components/ui';
import { HttpError } from '../data/api';
import { useCatalog, useMatrix } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { inLevel, type Level } from '../lib/entityLevel';
import { displayName } from '../lib/names';
import { describeRange } from '../lib/period';
import {
  changeOf,
  comparisonRange,
  MIN_BASE,
  rankEntities,
  type CompareMode,
  type NamedRow,
} from '../lib/ranking';
import { parseState, toSearchParams, type ReviewState } from '../lib/reviewState';

const COMPARE_MODES: readonly CompareMode[] = ['none', 'previous', 'yearAgo'];

export function Review() {
  const { t, fmt } = useI18n();
  const { manifest, byId } = useCatalog();
  const { matrix, error } = useMatrix();
  const [params, setParams] = useSearchParams();
  const months = manifest.months;
  const state = useMemo(() => parseState(params, months), [params, months]);
  const update = (patch: Partial<ReviewState>) =>
    setParams(toSearchParams({ ...state, ...patch }, months), { replace: true });

  const described = describeRange(months, state.range);
  const period =
    described.kind === 'month'
      ? fmt.month(described.period)
      : described.kind === 'year'
        ? t('review.range.year', { year: described.year })
        : t('review.range.span', { from: fmt.month(described.from), to: fmt.month(described.to) });
  const fileStem = `${months[state.range.from]}_${months[state.range.to]}`;
  usePageTitle(`${t('review.title')} – ${t('app.title')}`);

  const ranking = useMemo(() => {
    if (!matrix) return null;
    return rankEntities(matrix, {
      range: state.range,
      fuels: state.fuels,
      compare: state.compare,
      include: (id) => inLevel(byId.get(id)?.kind, state.level),
    });
  }, [matrix, state, byId]);

  const rows = useMemo<NamedRow[]>(
    () =>
      ranking?.rows.map((r) => {
        const entity = byId.get(r.id);
        return {
          ...r,
          name: displayName(entity?.label ?? r.id),
          make:
            state.level === 'model' && entity?.makeId
              ? displayName(byId.get(entity.makeId)?.label ?? '')
              : '',
        };
      }) ?? [],
    [ranking, byId, state.level],
  );

  const head = (
    <PageHeader title={t(`review.headline.${state.level}`, { period })} lede={t('review.lede')} />
  );

  if (error) {
    const missing = error instanceof HttpError && error.status === 404;
    return (
      <>
        {head}
        <StatusPanel
          tone={missing ? 'neutral' : 'error'}
          title={t(missing ? 'review.unavailable' : 'status.error')}
          hint={t(missing ? 'review.unavailableHint' : 'status.errorHint')}
        />
      </>
    );
  }

  const monthCount = months.length;
  const available = (mode: CompareMode) => comparisonRange(state.range, mode, monthCount) !== null;
  const compareOptions = COMPARE_MODES.map((mode) => ({
    value: mode,
    label: t(`review.compare.${mode}`),
    disabled: !available(mode),
  }));

  const total = ranking?.total ?? 0;
  const change = ranking ? changeOf(total, ranking.previousTotal) : null;
  const compareKey = state.compare === 'yearAgo' ? 'yearAgo' : 'previous';
  const changeText = change
    ? change.percent !== null
      ? fmt.signedPct(change.percent)
      : fmt.signedInt(change.delta)
    : '';
  const leader = rows[0];
  const partialYear = described.kind === 'year' && described.partial;

  return (
    <>
      {head}
      <div className="review-controls">
        <PeriodPicker months={months} range={state.range} onChange={(range) => update({ range })} />
        <div className="review-row">
          <Segmented<Level>
            label={t('review.level')}
            value={state.level}
            options={[
              { value: 'model', label: t('review.level.model') },
              { value: 'make', label: t('review.level.make') },
            ]}
            onChange={(level) => update({ level })}
          />
          <Segmented<CompareMode>
            label={t('review.compare')}
            value={ranking?.comparison ? state.compare : 'none'}
            options={compareOptions}
            onChange={(compare) => update({ compare })}
          />
        </div>
        <FuelFilter fuels={state.fuels} onChange={(fuels) => update({ fuels })} />
      </div>

      {!ranking ? (
        <div className="loading" role="status" aria-label={t('status.loading')}>
          <Skeleton height={72} />
          <Skeleton height={360} />
        </div>
      ) : rows.length === 0 ? (
        <StatusPanel title={t('review.empty')} hint={t('review.emptyHint')} />
      ) : (
        <>
          <Facts
            items={[
              {
                label: t('review.kpi.total'),
                value: fmt.int(total),
                note:
                  change && ranking.previousTotal !== null
                    ? t(`review.kpi.versus.${compareKey}`, {
                        n: fmt.int(ranking.previousTotal),
                        change: changeText,
                      })
                    : undefined,
                tone: change
                  ? change.delta > 0
                    ? 'positive'
                    : change.delta < 0
                      ? 'negative'
                      : 'neutral'
                  : 'neutral',
              },
              ...(leader
                ? [
                    {
                      label: t('review.kpi.leader'),
                      value: leader.name,
                      note: t('review.kpi.leaderNote', {
                        n: fmt.int(leader.count),
                        share: fmt.pct(leader.share),
                      }),
                    },
                  ]
                : []),
              { label: t(`review.kpi.distinct.${state.level}`), value: fmt.int(rows.length) },
            ]}
          />
          {partialYear && <p className="footnote">{t('review.partialYear')}</p>}
          {state.compare !== 'none' && !ranking.comparison && (
            <p className="footnote">{t('review.compareUnavailable')}</p>
          )}
          <RankingTable
            rows={rows}
            showChange={ranking.comparison !== null}
            caption={t(`review.caption.${state.level}`, { period })}
            period={fileStem}
          />
          <p className="footnote">{t('review.note', { min: MIN_BASE })}</p>
        </>
      )}
    </>
  );
}
