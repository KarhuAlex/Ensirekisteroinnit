import { StatusPanel } from '../../components/ui';
import { HttpError } from '../../data/api';
import { useCatalog, useMatrix } from '../../data/DataProvider';
import { useI18n } from '../../i18n';
import type { EntityLevel } from '../../lib/entityLevel';
import type { ReviewState } from '../../lib/reviewState';
import { EntityResults, ResultsSkeleton } from './EntityResults';

interface Props {
  state: ReviewState & { level: EntityLevel };
  periodLabel: string;
  partialYear: boolean;
  fileStem: string;
}

/** Corporate groups have no page of their own, so their rows are plain text. */
const NO_LINKS = () => false;

/** The ranking of new cars: models, makes or corporate groups. */
export function EntityView({ state, periodLabel, partialYear, fileStem }: Props) {
  const { t } = useI18n();
  const { byId } = useCatalog();
  const { matrix, error } = useMatrix();

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
  if (!matrix) return <ResultsSkeleton />;

  return (
    <EntityResults
      matrix={matrix}
      byId={byId}
      source="new"
      level={state.level}
      range={state.range}
      fuels={state.fuels}
      compare={state.compare}
      periodLabel={periodLabel}
      partialYear={partialYear}
      fileStem={fileStem}
      isLinked={state.level === 'corporategroup' ? NO_LINKS : undefined}
    />
  );
}
