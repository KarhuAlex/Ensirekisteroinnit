import { useI18n } from '../../i18n';
import type { RangeKind } from '../../lib/period';
import type { MonthRange } from '../../lib/ranking';
import { rangeLabel } from '../../lib/reviewHeadline';

/** The selected range as a phrase for headings and captions, such as "lokakuu 2026". */
export function useRangeLabel(
  months: readonly string[],
  range: MonthRange,
): { label: string; kind: RangeKind } {
  const { t, fmt } = useI18n();
  return rangeLabel(t, fmt, months, range);
}
