import { useMemo } from 'react';
import { RankingTable } from '../../components/RankingTable';
import { Facts, Skeleton, StatusPanel } from '../../components/ui';
import { HttpError } from '../../data/api';
import { useCatalog, useMatrix } from '../../data/DataProvider';
import { useI18n } from '../../i18n';
import { inLevel, type EntityLevel } from '../../lib/entityLevel';
import { displayName } from '../../lib/names';
import { changeOf, MIN_BASE, rankEntities, type NamedRow } from '../../lib/ranking';
import type { ReviewState } from '../../lib/reviewState';
import { toneOf } from '../../lib/stats';

interface Props {
  state: ReviewState & { level: EntityLevel };
  periodLabel: string;
  partialYear: boolean;
  fileStem: string;
}

export function EntityView({ state, periodLabel, partialYear, fileStem }: Props) {
  const { t, fmt } = useI18n();
  const { byId } = useCatalog();
  const { matrix, error } = useMatrix();

  const ranking = useMemo(() => {
    if (!matrix) return null;
    return rankEntities(matrix, {
      range: state.range,
      fuels: state.fuels,
      compare: state.compare,
      include: (id) => inLevel(byId.get(id)?.kind, state.level),
    });
  }, [matrix, state.range, state.fuels, state.compare, state.level, byId]);

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

  if (error) {
    const missing = error instanceof HttpError && error.status === 404;
    return (
      <StatusPanel
        tone={missing ? 'neutral' : 'error'}
        title={t(missing ? 'review.unavailable' : 'status.error')}
        hint={t(missing ? 'review.unavailableHint' : 'status.errorHint')}
      />
    );
  }
  if (!ranking) {
    return (
      <div className="loading" role="status" aria-label={t('status.loading')}>
        <Skeleton height={72} />
        <Skeleton height={360} />
      </div>
    );
  }
  if (rows.length === 0)
    return <StatusPanel title={t('review.empty')} hint={t('review.emptyHint')} />;

  const change = changeOf(ranking.total, ranking.previousTotal);
  const compareKey = state.compare === 'yearAgo' ? 'yearAgo' : 'previous';
  const changeText = change
    ? change.percent !== null
      ? fmt.signedPct(change.percent)
      : fmt.signedInt(change.delta)
    : '';
  const leader = rows[0];

  return (
    <>
      <Facts
        items={[
          {
            label: t('review.kpi.total'),
            value: fmt.int(ranking.total),
            note:
              change && ranking.previousTotal !== null
                ? t(`review.kpi.versus.${compareKey}`, {
                    n: fmt.int(ranking.previousTotal),
                    change: changeText,
                  })
                : undefined,
            tone: toneOf(change?.delta ?? null),
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
        caption={t(`review.caption.${state.level}`, { period: periodLabel })}
        period={fileStem}
      />
      <p className="footnote">{t('review.note', { min: MIN_BASE })}</p>
    </>
  );
}
