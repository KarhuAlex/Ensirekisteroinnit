import { useMemo } from 'react';
import { EntityPicker } from '../../components/EntityPicker';
import { FuelFilter } from '../../components/FuelFilter';
import { PeriodPicker } from '../../components/PeriodPicker';
import { Segmented } from '../../components/ui';
import { useCatalog } from '../../data/DataProvider';
import { useI18n } from '../../i18n';
import { effectiveMetric, isUnnarrowed } from '../../lib/areaMetrics';
import { comparisonRange, type CompareMode } from '../../lib/ranking';
import type { AreaLevel, AreaMetric, Level, ReviewState } from '../../lib/reviewState';

const COMPARE_MODES: readonly CompareMode[] = ['none', 'previous', 'yearAgo'];
const LEVELS: readonly Level[] = ['model', 'make', 'area'];
const AREA_LEVELS: readonly AreaLevel[] = ['region', 'municipality'];
const AREA_METRICS: readonly AreaMetric[] = ['share', 'index', 'count', 'change'];

interface Props {
  state: ReviewState;
  months: readonly string[];
  onChange: (patch: Partial<ReviewState>) => void;
}

/** Period, fuel and comparison apply to every view. */
export function ReviewControls({ state, months, onChange }: Props) {
  const { t } = useI18n();
  const { entities } = useCatalog();
  const pickable = useMemo(() => entities.filter((e) => e.kind !== 'total'), [entities]);

  const compareOptions = COMPARE_MODES.map((mode) => ({
    value: mode,
    label: t(`review.compare.${mode}`),
    disabled: comparisonRange(state.range, mode, months.length) === null,
  }));
  const compareAvailable = comparisonRange(state.range, state.compare, months.length) !== null;

  return (
    <div className="review-controls">
      <PeriodPicker months={months} range={state.range} onChange={(range) => onChange({ range })} />
      <div className="review-row">
        <Segmented<Level>
          label={t('review.level')}
          value={state.level}
          options={LEVELS.map((level) => ({ value: level, label: t(`review.level.${level}`) }))}
          onChange={(level) => onChange({ level })}
        />
        <Segmented<CompareMode>
          label={t('review.compare')}
          value={compareAvailable ? state.compare : 'none'}
          options={compareOptions}
          onChange={(compare) => onChange({ compare })}
        />
      </div>
      {state.level === 'area' && (
        <div className="review-row">
          <Segmented<AreaLevel>
            label={t('review.areaBy')}
            value={state.areaLevel}
            options={AREA_LEVELS.map((level) => ({ value: level, label: t(`review.by.${level}`) }))}
            onChange={(areaLevel) => onChange({ areaLevel })}
          />
          <Segmented<AreaMetric>
            label={t('review.metric')}
            value={effectiveMetric(state)}
            options={AREA_METRICS.map((metric) => ({
              value: metric,
              label: t(`review.metric.${metric}`),
              disabled:
                (metric === 'change' && !compareAvailable) ||
                (metric !== 'count' && isUnnarrowed(state)),
            }))}
            onChange={(areaMetric) => onChange({ areaMetric })}
          />
          <EntityPicker
            entities={pickable}
            value={state.entity}
            onChange={(entity) => onChange({ entity })}
          />
        </div>
      )}
      <FuelFilter fuels={state.fuels} onChange={(fuels) => onChange({ fuels })} />
    </div>
  );
}
