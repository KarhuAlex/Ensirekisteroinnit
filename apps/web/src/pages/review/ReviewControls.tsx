import { useMemo } from 'react';
import { EntityPicker } from '../../components/EntityPicker';
import { FuelFilter } from '../../components/FuelFilter';
import { PeriodPicker } from '../../components/PeriodPicker';
import { Segmented } from '../../components/ui';
import { useCatalog } from '../../data/DataProvider';
import { useHasCorporateGroups } from '../../data/useHasCorporateGroups';
import { useI18n } from '../../i18n';
import { isListed } from '../../lib/entityLevel';
import { effectiveMetric, isUnnarrowed } from '../../lib/areaMetrics';
import { comparisonRange, type CompareMode } from '../../lib/ranking';
import {
  effectiveLevel,
  levelAvailable,
  type AreaLevel,
  type AreaMetric,
  type Level,
  type ReviewState,
  type Source,
} from '../../lib/reviewState';

const SOURCES: readonly Source[] = ['new', 'used'];
const COMPARE_MODES: readonly CompareMode[] = ['none', 'previous', 'yearAgo'];
const LEVELS: readonly Level[] = ['model', 'make', 'corporategroup', 'area'];
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
  const hasGroups = useHasCorporateGroups();
  const levels = LEVELS.filter((option) => option !== 'corporategroup' || hasGroups);
  const pickable = useMemo(() => entities.filter((e) => isListed(e.kind)), [entities]);

  const compareOptions = COMPARE_MODES.map((mode) => ({
    value: mode,
    label: t(`review.compare.${mode}`),
    disabled: mode !== 'none' && comparisonRange(state.range, mode, months.length) === null,
  }));
  const level = effectiveLevel(state);
  const used = state.source === 'used';
  const compareAvailable = comparisonRange(state.range, state.compare, months.length) !== null;

  return (
    <div className="review-controls">
      <PeriodPicker months={months} range={state.range} onChange={(range) => onChange({ range })} />
      <div className="review-row">
        <Segmented<Source>
          label={t('review.source')}
          value={state.source}
          options={SOURCES.map((source) => ({
            value: source,
            label: t(`review.source.${source}`),
          }))}
          onChange={(source) => onChange({ source })}
        />
        <Segmented<Level>
          label={t('review.level')}
          value={level}
          options={levels.map((option) => ({
            value: option,
            label: t(`review.level.${option}`),
            disabled: !levelAvailable(state.source, option),
          }))}
          onChange={(next) => onChange({ level: next })}
        />
        <Segmented<CompareMode>
          label={t('review.compare')}
          value={compareAvailable ? state.compare : 'none'}
          options={compareOptions}
          onChange={(compare) => onChange({ compare })}
        />
      </div>
      {level === 'area' && (
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
      {used && <p className="muted hint">{t('review.used.limits')}</p>}
      <FuelFilter fuels={state.fuels} onChange={(fuels) => onChange({ fuels })} />
    </div>
  );
}
