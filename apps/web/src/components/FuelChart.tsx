import { totalSeries, type FuelGroupId, type GroupedSeries } from '@regs/core';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { fuelBarsChart } from '../lib/charts';
import { useNarrow, useReducedMotion } from '../lib/hooks';
import { STACK_ORDER, rangeStart, type RangeId } from '../lib/stats';
import { useThemeColors } from '../lib/theme';
import { ChartFocus } from './ChartFocus';
import { EChart } from './EChart';
import { FuelMark } from './FuelMark';
import { RangeControl } from './RangeControl';
import { Segmented } from './ui';

type Mode = 'share' | 'count';

interface Props {
  /** Category keys: `YYYY-MM` months, or year strings when `monthly` is false. */
  categories: string[];
  labels: string[];
  grouped: GroupedSeries;
  monthly: boolean;
  /** Areas suit long dense series, columns suit sparse or yearly data. */
  shape?: 'bars' | 'area';
  initialMode: Mode;
  switchableMode: boolean;
  /** Range presets, for monthly charts only. */
  withRanges: boolean;
  height: number;
  ariaLabel: string;
}

/**
 * Stacked fuel chart whose legend doubles as the readout: each plate shows the value for the month
 * under the pointer (the latest month by default) and toggles its fuel group.
 */
export function FuelChart({
  categories,
  labels,
  grouped,
  monthly,
  shape = 'bars',
  initialMode,
  switchableMode,
  withRanges,
  height,
  ariaLabel,
}: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [range, setRange] = useState<RangeId>('all');
  const [hidden, setHidden] = useState<ReadonlySet<FuelGroupId>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const n = categories.length;
  const totals = useMemo(() => totalSeries(grouped, n), [grouped, n]);
  const index = Math.min(hover ?? n - 1, n - 1);
  // Skip leading months without registrations, so a model that starts in 2021 does not
  // show 2014 to 2020.
  const firstIdx = Math.max(
    0,
    totals.findIndex((v) => v > 0),
  );
  const total = totals[index] ?? 0;
  const lowest = Math.max(firstIdx, monthly && withRanges ? rangeStart(n, range) : 0);
  const present = STACK_ORDER.filter((g) => grouped[g].some((v) => v > 0));

  const option = useMemo(
    () =>
      fuelBarsChart({
        colors,
        fmt,
        categories,
        grouped,
        mode,
        monthly,
        shape,
        hidden,
        startIndex: lowest,
        reducedMotion,
      }),
    [colors, fmt, categories, grouped, mode, monthly, hidden, lowest, shape, reducedMotion],
  );

  const describe = (i: number) => {
    const sum = totals[i] ?? 0;
    return [
      labels[i],
      ...present
        .filter((g) => !hidden.has(g))
        .map((g) => {
          const count = grouped[g][i] ?? 0;
          const value =
            mode === 'share' ? fmt.pct(sum > 0 ? (count / sum) * 100 : null) : fmt.int(count);
          return `${t(`fuel.group.${g}`)} ${value}`;
        }),
      t('readout.total', { n: fmt.int(sum) }),
    ].join(', ');
  };

  const toggle = (group: FuelGroupId) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div>
      <div className="chart-bar">
        <p className="readout-head" aria-live="off">
          <strong>{labels[index]}</strong>
          <span>{t('readout.total', { n: fmt.int(total) })}</span>
        </p>
        <div className="chart-controls">
          {withRanges && monthly && <RangeControl value={range} onChange={setRange} />}
          {switchableMode && (
            <Segmented
              label={t('chart.mode')}
              value={mode}
              options={[
                { value: 'share', label: t('chart.modeShare') },
                { value: 'count', label: t('chart.modeCount') },
              ]}
              onChange={setMode}
            />
          )}
        </div>
      </div>

      <ul className="plates" aria-label={t('legend.title')}>
        {present.map((group) => {
          const count = grouped[group][index] ?? 0;
          const value =
            mode === 'share' ? fmt.pct(total > 0 ? (count / total) * 100 : null) : fmt.int(count);
          const off = hidden.has(group);
          return (
            <li key={group}>
              <button
                type="button"
                className="plate-button"
                aria-pressed={!off}
                title={t('legend.toggle', { name: t(`fuel.group.${group}`) })}
                onClick={() => toggle(group)}
              >
                <FuelMark group={group} />
                <span className="plate-name">{t(`fuel.group.${group}`)}</span>
                <span className="plate-value">{off ? '–' : value}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <ChartFocus
        ariaLabel={ariaLabel}
        count={n}
        lowest={lowest}
        hover={hover}
        onHover={setHover}
        describe={describe}
      >
        {(bindings) => (
          <EChart
            option={option}
            height={narrow ? Math.round(height * 0.78) : height}
            ariaLabel={ariaLabel}
            {...bindings}
          />
        )}
      </ChartFocus>
    </div>
  );
}
