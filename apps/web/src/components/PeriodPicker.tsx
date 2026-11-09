import { useI18n } from '../i18n';
import {
  describeRange,
  monthOf,
  PRESET_IDS,
  presetRange,
  stepRange,
  yearRange,
  yearsOf,
} from '../lib/period';
import { sameRange, type MonthRange } from '../lib/ranking';
import { yearOf } from '../lib/stats';
import { Icon } from './Icon';

type End = 'from' | 'to';

export function PeriodPicker({
  months,
  range,
  onChange,
}: {
  months: readonly string[];
  range: MonthRange;
  onChange: (range: MonthRange) => void;
}) {
  const { t, fmt } = useI18n();
  const years = yearsOf(months);
  const described = describeRange(months, range);
  const wholeYear = described.kind === 'year' ? described.year : '';

  const closestMonthIndex = (year: string, month: number): number => {
    const span = yearRange(months, year);
    if (!span) return -1;
    const first = monthOf(months[span.from]!);
    const last = monthOf(months[span.to]!);
    return span.from + Math.min(Math.max(month, first), last) - first;
  };

  const setEnd = (end: End, year: string, month: number) => {
    const index = closestMonthIndex(year, month);
    if (index < 0) return;
    onChange(
      end === 'from'
        ? { from: index, to: Math.max(index, range.to) }
        : { from: Math.min(range.from, index), to: index },
    );
  };

  const prev = stepRange(range, -1, months.length);
  const next = stepRange(range, 1, months.length);

  const field = (end: End) => {
    const period = months[range[end]]!;
    const year = yearOf(period);
    const span = yearRange(months, year)!;
    const first = monthOf(months[span.from]!);
    const last = monthOf(months[span.to]!);
    const label = t(end === 'from' ? 'review.from' : 'review.to');
    return (
      <fieldset className="period-end">
        <legend>{label}</legend>
        <select
          aria-label={`${label}: ${t('review.month')}`}
          value={monthOf(period)}
          onChange={(e) => setEnd(end, year, Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m} disabled={m < first || m > last}>
              {fmt.monthName(m)}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: ${t('review.year')}`}
          value={year}
          onChange={(e) => setEnd(end, e.target.value, monthOf(period))}
        >
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </fieldset>
    );
  };

  return (
    <div className="period-picker" role="group" aria-label={t('review.period')}>
      <div className="chips">
        {PRESET_IDS.map((id) => {
          const preset = presetRange(months, id);
          return preset ? (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={sameRange(preset, range)}
              onClick={() => onChange(preset)}
            >
              {t(`review.preset.${id}`)}
            </button>
          ) : null;
        })}
      </div>
      <div className="period-fields">
        {field('from')}
        {field('to')}
        <label className="field">
          <span>{t('review.wholeYear')}</span>
          <select
            value={wholeYear}
            onChange={(e) => {
              const span = yearRange(months, e.target.value);
              if (span) onChange(span);
            }}
          >
            <option value="" disabled>
              {t('review.pickYear')}
            </option>
            {[...years].reverse().map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <div className="stepper">
          <button
            type="button"
            className="tool-button"
            disabled={!prev}
            onClick={() => prev && onChange(prev)}
            aria-label={t('review.prev')}
            title={t('review.prev')}
          >
            <Icon name="arrowLeft" />
          </button>
          <button
            type="button"
            className="tool-button"
            disabled={!next}
            onClick={() => next && onChange(next)}
            aria-label={t('review.next')}
            title={t('review.next')}
          >
            <Icon name="arrowRight" />
          </button>
        </div>
      </div>
    </div>
  );
}
