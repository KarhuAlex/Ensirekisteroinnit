import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { shareLinesChart } from '../lib/charts';
import { focusIndex, useNarrow, useReducedMotion, useTimeline, type Timeline } from '../lib/hooks';
import { rangeStart } from '../lib/stats';
import { useThemeColors } from '../lib/theme';
import { ChartFocus } from './ChartFocus';
import { EChart } from './EChart';
import { FuelMark } from './FuelMark';
import { RangeControl } from './RangeControl';

interface Props {
  months: string[];
  bev: (number | null)[];
  plugIn: (number | null)[];
  height: number;
  ariaLabel: string;
  /** Set when other charts share the range and the pointer; its owner then shows the range control. */
  timeline?: Timeline;
}

export function RollingChart({ months, bev, plugIn, height, ariaLabel, timeline }: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const own = useTimeline();
  const shared = timeline ?? own;
  const { range, setRange, hover, setHover } = shared;
  const n = months.length;
  const index = focusIndex(shared, n);
  const start = rangeStart(n, range);

  const option = useMemo(
    () =>
      shareLinesChart({
        colors,
        fmt,
        months,
        startIndex: start,
        reducedMotion,
        series: [
          { name: t('chart.plugLine'), color: colors.fuel.phev, values: plugIn },
          { name: t('chart.bevLine'), color: colors.fuel.bev, values: bev },
        ],
      }),
    [colors, fmt, months, start, reducedMotion, t, plugIn, bev],
  );

  return (
    <div>
      {!timeline && (
        <div className="chart-bar">
          <p className="readout-head">
            <strong>{fmt.month(months[index] ?? '')}</strong>
          </p>
          <RangeControl value={range} onChange={setRange} />
        </div>
      )}
      <ul className="plates" aria-label={t('legend.title')}>
        <li>
          <span className="plate-button is-static">
            <FuelMark group="bev" />
            <span className="plate-name">{t('chart.bevLine')}</span>
            <span className="plate-value">{fmt.pct(bev[index] ?? null)}</span>
          </span>
        </li>
        <li>
          <span className="plate-button is-static">
            <FuelMark group="bev" />
            <FuelMark group="phev" />
            <span className="plate-name">{t('chart.plugLine')}</span>
            <span className="plate-value">{fmt.pct(plugIn[index] ?? null)}</span>
          </span>
        </li>
      </ul>
      <ChartFocus
        ariaLabel={ariaLabel}
        count={n}
        lowest={start}
        hover={hover}
        onHover={setHover}
        describe={(i) =>
          [
            fmt.month(months[i] ?? ''),
            `${t('chart.bevLine')} ${fmt.pct(bev[i] ?? null)}`,
            `${t('chart.plugLine')} ${fmt.pct(plugIn[i] ?? null)}`,
          ].join(', ')
        }
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
