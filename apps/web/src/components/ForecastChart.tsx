import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { forecastChart } from '../lib/charts';
import {
  chartSeries,
  padTo,
  type PastScenario,
  type Scenario,
  type ShareHistory,
} from '../lib/forecastView';
import { useNarrow, useReducedMotion } from '../lib/hooks';
import { useThemeColors } from '../lib/theme';
import { ChartFocus } from './ChartFocus';
import { EChart } from './EChart';

/** How many months of the facts are shown before the scenario begins. */
const MONTHS_SHOWN = 60;

interface Props {
  history: ShareHistory;
  /** The scenario to draw after the facts; left out where the chart is of the facts alone. */
  scenario?: Scenario | null;
  /** Forecasts made earlier, to be seen beside what came to be. */
  past?: PastScenario[];
  height: number;
  ariaLabel: string;
}

/** The share of battery-electric cars: the facts as a line, and the scenario after them. */
export function ForecastChart({ history, scenario = null, past = [], height, ariaLabel }: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => chartSeries(history, scenario), [history, scenario]);
  const count = series.months.length;
  const lastFact = history.months.length - 1;
  const start = Math.max(0, lastFact - MONTHS_SHOWN + 1);
  const index = Math.min(hover ?? lastFact, count - 1);

  const option = useMemo(
    () =>
      forecastChart({
        colors,
        fmt,
        months: series.months,
        startIndex: start,
        reducedMotion,
        actual: series.actual,
        path: series.path,
        low: series.low,
        high: series.high,
        past: past.map((p) => ({
          name: t('forecast.pastName', { month: fmt.month(p.origin) }),
          values: padTo(p.values, count),
        })),
        ...(scenario && scenario.ceiling < 1
          ? {
              ceiling: {
                percent: scenario.ceiling * 100,
                label: t('forecast.ceilingLine', { ceiling: Math.round(scenario.ceiling * 100) }),
              },
            }
          : {}),
        ...(scenario
          ? {
              boundary: {
                month: history.months[lastFact] ?? '',
                label: t('forecast.boundary'),
              },
            }
          : {}),
        names: {
          actual: t('forecast.actual'),
          path: t('forecast.scenario'),
          band: t('forecast.band'),
        },
      }),
    [colors, fmt, series, start, reducedMotion, past, count, scenario, history.months, lastFact, t],
  );

  const describe = (i: number): string => {
    const month = fmt.month(series.months[i] ?? '');
    const fact = series.actual[i];
    if (fact !== null && fact !== undefined)
      return `${month}, ${t('forecast.actual')} ${fmt.pct(fact)}`;
    const value = series.path[i];
    const low = series.low[i];
    const high = series.high[i];
    return value !== null && value !== undefined
      ? `${month}, ${t('forecast.scenario')} ${fmt.pct(value)} (${fmt.pct(low ?? null)} – ${fmt.pct(high ?? null)})`
      : month;
  };

  return (
    <div>
      <p className="readout-head" aria-hidden="true">
        <strong>{describe(index)}</strong>
      </p>
      <ul className="forecast-legend" aria-hidden="true">
        <li>
          <span className="swatch swatch--fact" /> {t('forecast.actual')}
        </li>
        {scenario && (
          <>
            <li>
              <span className="swatch swatch--scenario" /> {t('forecast.scenario')}
            </li>
            <li>
              <span className="swatch swatch--band" /> {t('forecast.band')}
            </li>
          </>
        )}
        {past.length > 0 && (
          <li>
            <span className="swatch swatch--past" /> {t('forecast.past')}
          </li>
        )}
      </ul>
      <ChartFocus
        ariaLabel={ariaLabel}
        count={count}
        lowest={start}
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
