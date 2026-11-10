import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, usePageTitle } from '../components/ui';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { displayName } from '../lib/names';
import { parseState, toSearchParams, type ReviewState } from '../lib/reviewState';
import { AreaView } from './review/AreaView';
import { EntityView } from './review/EntityView';
import { ReviewControls } from './review/ReviewControls';
import { useRangeLabel } from './review/useRangeLabel';

export function Review() {
  const { t } = useI18n();
  const { manifest, byId } = useCatalog();
  const [params, setParams] = useSearchParams();
  const months = manifest.months;
  const state = useMemo(() => parseState(params, months), [params, months]);
  const update = (patch: Partial<ReviewState>) =>
    setParams(toSearchParams({ ...state, ...patch }, months), { replace: true });

  const { label: periodLabel, kind } = useRangeLabel(months, state.range);
  const fileStem = `${months[state.range.from]}_${months[state.range.to]}`;
  usePageTitle(`${t('review.title')} – ${t('app.title')}`);

  const entity = state.entity ? byId.get(state.entity) : undefined;
  const headline =
    state.level === 'area'
      ? entity
        ? t('review.headline.areaEntity', {
            entity: displayName(entity.label),
            period: periodLabel,
          })
        : t('review.headline.area', { period: periodLabel })
      : t(`review.headline.${state.level}`, { period: periodLabel });

  return (
    <>
      <PageHeader title={headline} lede={t('review.lede')} />
      <ReviewControls state={state} months={months} onChange={update} />
      {state.level === 'area' ? (
        <AreaView state={state} months={months} periodLabel={periodLabel} fileStem={fileStem} />
      ) : (
        <EntityView
          state={{ ...state, level: state.level }}
          periodLabel={periodLabel}
          partialYear={kind.kind === 'year' && kind.partial}
          fileStem={fileStem}
        />
      )}
    </>
  );
}
