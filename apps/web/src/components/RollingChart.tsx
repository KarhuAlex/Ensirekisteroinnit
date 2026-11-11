import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { shareLinesChart } from '../lib/charts';
import { focusIndex, useNarrow, useReducedMotion, useTimeline, type Timeline } from '../lib/hooks';
import { axisTop, firstPoint, pointLabel } from '../lib/rolling';
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
  /** The points are quarters (named by the month they end in): always the whole span, labelled by day. */
  quarterly?: boolean;
}

export function RollingChart({
  months,
  bev,
  plugIn,
  height,
  ariaLabel,
  timeline,
  quarterly = false,
}: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const own = useTimeline();
  const shared = timeline ?? own;
  const { range, setRange, hover, setHover } = shared;
  const n = months.length;
  const index = focusIndex(shared, n);
  const start = firstPoint(quarterly, n, range);
  const label = (period: string) => pointLabel(fmt, period, quarterly);
  const yMax = axisTop(quarterly, plugIn);

  const option = useMemo(
    () =>
      shareLinesChart({
        colors,
        fmt,
        months,
        startIndex: start,
        reducedMotion,
        quarterly,
        ...(yMax === undefined ? {} : { yMax }),
        series: [
          { name: t('chart.plugLine'), color: colors.fuel.phev, values: plugIn },
          { name: t('chart.bevLine'), color: colors.fuel.bev, values: bev },
        ],
      }),
    [colors, fmt, months, start, reducedMotion, quarterly, yMax, t, plugIn, bev],
  );

  return (
    <div>
      {!timeline && (
        <div className="chart-bar">
          <p className="readout-head">
            <strong>{label(months[index] ?? '')}</strong>
          </p>
          {!quarterly && <RangeControl value={range} onChange={setRange} />}
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
        unit={quarterly ? 'quarter' : 'month'}
        count={n}
        lowest={start}
        hover={hover}
        onHover={setHover}
        describe={(i) =>
          [
            label(months[i] ?? ''),
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
