import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { priceLinesChart } from '../lib/charts';
import { focusIndex, useNarrow, useReducedMotion, type Timeline } from '../lib/hooks';
import { MONTHS_PER_YEAR, rangeStart, rollingMean } from '../lib/stats';
import { useThemeColors } from '../lib/theme';
import { ChartFocus } from './ChartFocus';
import { EChart } from './EChart';
import { FuelMark } from './FuelMark';

interface Props {
  months: string[];
  /** Euros per litre for each of `months`; `null` where the source has no price. */
  petrol: (number | null)[];
  diesel: (number | null)[];
  timeline: Timeline;
  height: number;
  ariaLabel: string;
}

/** Pump prices of petrol and diesel as monthly lines with their 12-month averages. */
export function PriceChart({ months, petrol, diesel, timeline, height, ariaLabel }: Props) {
  const { t, fmt } = useI18n();
  const colors = useThemeColors();
  const narrow = useNarrow();
  const reducedMotion = useReducedMotion();
  const { range, hover, setHover } = timeline;
  const n = months.length;
  const index = focusIndex(timeline, n);
  const start = rangeStart(n, range);

  const option = useMemo(
    () =>
      priceLinesChart({
        colors,
        fmt,
        months,
        startIndex: start,
        reducedMotion,
        series: [
          {
            name: t('prices.petrol'),
            color: colors.fuel.petrol,
            monthly: petrol,
            average: rollingMean(petrol, MONTHS_PER_YEAR),
          },
          {
            name: t('prices.diesel'),
            color: colors.fuel.diesel,
            monthly: diesel,
            average: rollingMean(diesel, MONTHS_PER_YEAR),
          },
        ],
      }),
    [colors, fmt, months, start, reducedMotion, t, petrol, diesel],
  );

  const petrolNow = petrol[index] ?? null;
  const dieselNow = diesel[index] ?? null;
  const difference = petrolNow !== null && dieselNow !== null ? dieselNow - petrolNow : null;

  return (
    <div>
      <ul className="plates" aria-label={t('prices.legend')}>
        <li>
          <span className="plate-button is-static">
            <FuelMark group="petrol" />
            <span className="plate-name">{t('prices.petrol')}</span>
            <span className="plate-value">{fmt.price(petrolNow)}</span>
          </span>
        </li>
        <li>
          <span className="plate-button is-static">
            <FuelMark group="diesel" />
            <span className="plate-name">{t('prices.diesel')}</span>
            <span className="plate-value">{fmt.price(dieselNow)}</span>
          </span>
        </li>
        <li>
          <span className="plate-button is-static">
            <span className="plate-name">{t('prices.difference')}</span>
            <span className="plate-value">
              {difference === null ? '–' : fmt.signedPrice(difference)}
            </span>
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
            `${t('prices.petrol')} ${fmt.price(petrol[i] ?? null)}`,
            `${t('prices.diesel')} ${fmt.price(diesel[i] ?? null)}`,
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
