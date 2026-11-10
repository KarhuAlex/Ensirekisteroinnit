import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, usePageTitle } from '../components/ui';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { displayName } from '../lib/names';
import {
  effectiveLevel,
  parseState,
  toSearchParams,
  withAvailableLevel,
  type ReviewState,
} from '../lib/reviewState';
import { AreaView } from './review/AreaView';
import { EntityView } from './review/EntityView';
import { ReviewControls } from './review/ReviewControls';
import { UsedView } from './review/UsedView';
import { useHasCorporateGroups } from './review/useHasCorporateGroups';
import { useRangeLabel } from './review/useRangeLabel';

type Translate = ReturnType<typeof useI18n>['t'];

function reviewHeadline(
  t: Translate,
  state: ReviewState,
  entity: { label: string } | undefined,
  period: string,
): string {
  const level = effectiveLevel(state);
  if (state.source === 'used') return t('review.headline.used', { period });
  if (level !== 'area') return t(`review.headline.${level}`, { period });
  return entity
    ? t('review.headline.areaEntity', { entity: displayName(entity.label), period })
    : t('review.headline.area', { period });
}

export function Review() {
  const { t } = useI18n();
  const { manifest, byId } = useCatalog();
  const [params, setParams] = useSearchParams();
  const months = manifest.months;
  const hasGroups = useHasCorporateGroups();
  const state = useMemo(
    () => withAvailableLevel(parseState(params, months), hasGroups),
    [params, months, hasGroups],
  );
  const update = (patch: Partial<ReviewState>) =>
    setParams(toSearchParams({ ...state, ...patch }, months), { replace: true });

  const { label: periodLabel, kind } = useRangeLabel(months, state.range);
  const fileStem = `${months[state.range.from]}_${months[state.range.to]}`;
  usePageTitle(`${t('review.title')} – ${t('app.title')}`);

  const used = state.source === 'used';
  const headline = reviewHeadline(
    t,
    state,
    state.entity ? byId.get(state.entity) : undefined,
    periodLabel,
  );
  const partialYear = kind.kind === 'year' && kind.partial;

  return (
    <>
      <PageHeader title={headline} lede={t(used ? 'review.used.lede' : 'review.lede')} />
      <ReviewControls state={state} months={months} onChange={update} />
      {used ? (
        <UsedView
          state={state}
          periodLabel={periodLabel}
          partialYear={partialYear}
          fileStem={fileStem}
        />
      ) : state.level === 'area' ? (
        <AreaView state={state} months={months} periodLabel={periodLabel} fileStem={fileStem} />
      ) : (
        <EntityView
          state={{ ...state, level: state.level }}
          periodLabel={periodLabel}
          partialYear={partialYear}
          fileStem={fileStem}
        />
      )}
    </>
  );
}
