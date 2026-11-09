import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { shareLinesChart } from '../lib/charts';
import { useNarrow, useReducedMotion } from '../lib/hooks';
import { RANGE_IDS, rangeStart, type RangeId } from '../lib/stats';
import { useThemeColors } from '../lib/theme';
import { ChartFocus } from './ChartFocus';
import { EChart } from './EChart';
import { FuelMark } from './FuelMark';
import { Segmented } from './ui';

interface Props {
  months: string[];
  bev: (number | null)[];
  plugIn: (number | null)[];
  height: number;
  ariaLabel: string;
}

export function RollingChart({ months, bev, plugIn, height, ariaLabel }: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState<RangeId>('all');
  const [hover, setHover] = useState<number | null>(null);
  const n = months.length;
  const index = Math.min(hover ?? n - 1, n - 1);
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
      <div className="chart-bar">
        <p className="readout-head">
          <strong>{fmt.month(months[index] ?? '')}</strong>
        </p>
        <Segmented
          label={t('range.label')}
          value={range}
          options={RANGE_IDS.map((r) => ({ value: r, label: t(`range.${r}`) }))}
          onChange={setRange}
        />
      </div>
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
