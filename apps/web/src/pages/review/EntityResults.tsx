import type { EntitySummary, FuelGroupId, Matrix } from '@regs/core';
import { useMemo } from 'react';
import { RankingTable } from '../../components/RankingTable';
import { Facts, Skeleton, StatusPanel } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { inLevel, type EntityLevel } from '../../lib/entityLevel';
import { displayName } from '../../lib/names';
import {
  changeOf,
  MIN_BASE,
  rankEntities,
  type CompareMode,
  type MonthRange,
  type NamedRow,
} from '../../lib/ranking';
import type { Source } from '../../lib/reviewState';
import { toneOf } from '../../lib/stats';

/** The words that change with what is ranked. */
interface Wording {
  caption: MessageKey;
  total: MessageKey;
  leader: MessageKey;
  count: MessageKey;
  distinct: MessageKey;
  note: MessageKey;
}

function wordingFor(source: Source, level: EntityLevel): Wording {
  if (source === 'used') {
    return {
      caption: 'review.caption.used',
      total: 'review.used.kpi.total',
      leader: 'review.used.kpi.leader',
      count: 'review.used.col.count',
      distinct: 'review.kpi.distinct.make',
      note: 'review.used.note',
    };
  }
  return {
    caption: level === 'make' ? 'review.caption.make' : 'review.caption.model',
    total: 'review.kpi.total',
    leader: 'review.kpi.leader',
    count: 'review.col.count',
    distinct: level === 'make' ? 'review.kpi.distinct.make' : 'review.kpi.distinct.model',
    note: 'review.note',
  };
}

export function ResultsSkeleton() {
  const { t } = useI18n();
  return (
    <div className="loading" role="status" aria-label={t('status.loading')}>
      <Skeleton height={72} />
      <Skeleton height={360} />
    </div>
  );
}

interface Props {
  matrix: Matrix;
  byId: ReadonlyMap<string, EntitySummary>;
  source: Source;
  level: EntityLevel;
  /** The range as indexes into this matrix's months. */
  range: MonthRange;
  fuels: readonly FuelGroupId[];
  compare: CompareMode;
  periodLabel: string;
  partialYear: boolean;
  fileStem: string;
  /** Which rows get a link to their page; every row does by default. */
  isLinked?: (id: string) => boolean;
}

/** The ranking of makes or models in one matrix for the chosen period. */
export function EntityResults({
  matrix,
  byId,
  source,
  level,
  range,
  fuels,
  compare,
  periodLabel,
  partialYear,
  fileStem,
  isLinked,
}: Props) {
  const { t, fmt } = useI18n();
  const words = wordingFor(source, level);

  const ranking = useMemo(
    () =>
      rankEntities(matrix, {
        range,
        fuels,
        compare,
        include: (id) => inLevel(byId.get(id)?.kind, level),
      }),
    [matrix, range, fuels, compare, level, byId],
  );

  const rows = useMemo<NamedRow[]>(
    () =>
      ranking.rows.map((r) => {
        const entity = byId.get(r.id);
        return {
          ...r,
          name: displayName(entity?.label ?? r.id),
          make:
            level === 'model' && entity?.makeId
              ? displayName(byId.get(entity.makeId)?.label ?? '')
              : '',
        };
      }),
    [ranking, byId, level],
  );

  if (rows.length === 0) {
    return <StatusPanel title={t('review.empty')} hint={t('review.emptyHint')} />;
  }

  const change = changeOf(ranking.total, ranking.previousTotal);
  const compareKey = compare === 'yearAgo' ? 'yearAgo' : 'previous';
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
            label: t(words.total),
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
                  label: t(words.leader),
                  value: leader.name,
                  note: t('review.kpi.leaderNote', {
                    n: fmt.int(leader.count),
                    share: fmt.pct(leader.share),
                  }),
                },
              ]
            : []),
          { label: t(words.distinct), value: fmt.int(rows.length) },
        ]}
      />
      {partialYear && <p className="footnote">{t('review.partialYear')}</p>}
      {compare !== 'none' && !ranking.comparison && (
        <p className="footnote">{t('review.compareUnavailable')}</p>
      )}
      <RankingTable
        rows={rows}
        showChange={ranking.comparison !== null}
        caption={t(words.caption, { period: periodLabel })}
        countHeader={t(words.count)}
        period={fileStem}
        {...(isLinked ? { isLinked } : {})}
      />
      <p className="footnote">{t(words.note, { min: MIN_BASE })}</p>
    </>
  );
}
