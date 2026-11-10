import { useMemo } from 'react';
import { ChartFocus } from '../../components/ChartFocus';
import { EChart } from '../../components/EChart';
import { SeriesMark } from '../../components/SeriesMark';
import { useI18n } from '../../i18n';
import { compareLinesChart } from '../../lib/charts';
import { focusIndex, useNarrow, useReducedMotion, type Timeline } from '../../lib/hooks';
import { rangeStart } from '../../lib/stats';
import { useThemeColors } from '../../lib/theme';

export interface CompareLine {
  id: string;
  name: string;
  slot: number;
  values: (number | null)[];
}

interface Props {
  months: string[];
  lines: CompareLine[];
  unit: 'count' | 'pct';
  timeline: Timeline;
  height: number;
  ariaLabel: string;
}

/** The compared things as lines over the months, with a readout of the month under the pointer. */
export function CompareChart({ months, lines, unit, timeline, height, ariaLabel }: Props) {
  const { fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const n = months.length;
  const index = focusIndex(timeline, n);
  const start = rangeStart(n, timeline.range);
  const write = (value: number | null) =>
    value === null ? '–' : unit === 'pct' ? fmt.pct(value) : fmt.int(value);

  const option = useMemo(
    () =>
      compareLinesChart({
        colors,
        fmt,
        months,
        startIndex: start,
        reducedMotion,
        unit,
        series: lines.map(({ name, slot, values }) => ({ name, slot, values })),
      }),
    [colors, fmt, months, start, reducedMotion, unit, lines],
  );

  return (
    <div>
      <p className="readout-head">
        <strong>{fmt.month(months[index] ?? '')}</strong>
      </p>
      <ul className="plates compare-plates">
        {lines.map((line) => (
          <li key={line.id}>
            <span className="plate-button is-static">
              <SeriesMark slot={line.slot} />
              <span className="plate-name">{line.name}</span>
              <span className="plate-value">{write(line.values[index] ?? null)}</span>
            </span>
          </li>
        ))}
      </ul>
      <ChartFocus
        ariaLabel={ariaLabel}
        count={n}
        lowest={start}
        hover={timeline.hover}
        onHover={timeline.setHover}
        describe={(i) =>
          [
            fmt.month(months[i] ?? ''),
            ...lines.map((line) => `${line.name} ${write(line.values[i] ?? null)}`),
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
