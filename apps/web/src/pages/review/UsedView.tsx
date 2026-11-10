import { useCallback } from 'react';
import { StatusPanel } from '../../components/ui';
import { useCatalog } from '../../data/DataProvider';
import { useUsedImports } from '../../data/used';
import { useI18n } from '../../i18n';
import { translateRange } from '../../lib/period';
import type { ReviewState } from '../../lib/reviewState';
import { EntityResults, ResultsSkeleton } from './EntityResults';

interface Props {
  state: ReviewState;
  periodLabel: string;
  partialYear: boolean;
  fileStem: string;
}

/** The ranking of cars imported used. They are known by make only, so this is always makes. */
export function UsedView({ state, periodLabel, partialYear, fileStem }: Props) {
  const { t, fmt } = useI18n();
  const { manifest, byId: nationalById } = useCatalog();
  const used = useUsedImports();
  // Only makes with a page of their own link to it; a model with the same slug does not count.
  const isLinked = useCallback(
    (id: string) => nationalById.get(id)?.kind === 'make',
    [nationalById],
  );

  if (used.status === 'unavailable') {
    return (
      <StatusPanel title={t('review.used.unavailable')} hint={t('review.used.unavailableHint')} />
    );
  }
  if (used.status === 'error') {
    return <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />;
  }
  if (used.status === 'loading') return <ResultsSkeleton />;

  // This table is published separately and can be a month behind the registrations.
  const { matrix, byId } = used.data;
  const latestUsed = matrix.months[matrix.months.length - 1];
  const lagging = latestUsed !== undefined && (manifest.months[state.range.to] ?? '') > latestUsed;
  const lagNote = lagging && (
    <p className="footnote">{t('review.used.lag', { month: fmt.month(latestUsed) })}</p>
  );

  const range = translateRange(manifest.months, matrix.months, state.range);
  if (!range) {
    return (
      <>
        <StatusPanel title={t('review.empty')} hint={t('review.emptyHint')} />
        {lagNote}
      </>
    );
  }

  return (
    <>
      {lagNote}
      <EntityResults
        matrix={matrix}
        byId={byId}
        source="used"
        level="make"
        range={range}
        fuels={state.fuels}
        compare={state.compare}
        periodLabel={periodLabel}
        partialYear={partialYear}
        fileStem={fileStem}
        isLinked={isLinked}
      />
    </>
  );
}
