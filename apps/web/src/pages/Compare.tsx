import { PageHeader, Skeleton, StatusPanel, usePageTitle } from '../components/ui';
import { useCatalog, useMatrix } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { MAX_COMPARED } from '../lib/comparison';
import { CompareNotes } from './compare/CompareNotes';
import { CompareResults } from './compare/CompareResults';
import { CompareSelection } from './compare/CompareSelection';
import { useCompare } from './compare/useCompare';

/** Makes, models or corporate groups side by side: their registrations over time and the last year. */
export function Compare() {
  const { t } = useI18n();
  const { manifest } = useCatalog();
  const compare = useCompare();
  const { state, chosen } = compare;
  const { matrix, error } = useMatrix(chosen.length > 0);
  usePageTitle(`${t('compare.title')} – ${t('app.title')}`);

  return (
    <>
      <PageHeader title={t('compare.title')} lede={t('compare.lede', { max: MAX_COMPARED })} />
      <CompareSelection
        chosen={chosen}
        candidates={compare.candidates}
        level={compare.level}
        slots={compare.slots}
        onAdd={(id) => compare.update({ items: [...state.items, id] })}
        onRemove={(id) => compare.update({ items: state.items.filter((item) => item !== id) })}
      />
      {error ? (
        <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />
      ) : chosen.length === 0 ? (
        <StatusPanel title={t('compare.empty')} hint={t('compare.emptyHint')} />
      ) : !matrix ? (
        <Skeleton height={340} label={t('status.loading')} />
      ) : (
        <CompareResults
          matrix={matrix}
          months={manifest.months}
          chosen={chosen}
          slots={compare.slots}
          metric={state.metric}
          timeline={compare.timeline}
          onMetric={(metric) => compare.update({ metric })}
        />
      )}
      <CompareNotes dropped={compare.dropped} chosen={chosen.length} level={compare.level} />
    </>
  );
}
