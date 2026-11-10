import { useI18n } from '../../i18n';
import { describeRange, type RangeKind } from '../../lib/period';
import type { MonthRange } from '../../lib/ranking';

/** The selected range as a phrase for headings and captions, such as "lokakuu 2026". */
export function useRangeLabel(
  months: readonly string[],
  range: MonthRange,
): { label: string; kind: RangeKind } {
  const { t, fmt } = useI18n();
  const kind = describeRange(months, range);
  const label =
    kind.kind === 'month'
      ? fmt.month(kind.period)
      : kind.kind === 'year'
        ? t('review.range.year', { year: kind.year })
        : t('review.range.span', { from: fmt.month(kind.from), to: fmt.month(kind.to) });
  return { label, kind };
}
