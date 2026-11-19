import type { Translate } from '../i18n/translate';
import type { Formatters } from './format';
import { displayName } from './names';
import { describeRange, type RangeKind } from './period';
import type { MonthRange } from './ranking';
import { effectiveLevel, type ReviewState } from './reviewState';

/** The selected range as a phrase for headings and captions, such as "lokakuu 2026". */
export function rangeLabel(
  t: Translate,
  fmt: Formatters,
  months: readonly string[],
  range: MonthRange,
): { label: string; kind: RangeKind } {
  const kind = describeRange(months, range);
  const label =
    kind.kind === 'month'
      ? fmt.month(kind.period)
      : kind.kind === 'year'
        ? t('review.range.year', { year: kind.year })
        : t('review.range.span', { from: fmt.month(kind.from), to: fmt.month(kind.to) });
  return { label, kind };
}

/** The review page's heading: what is ranked, and over which period. */
export function reviewHeadline(
  t: Translate,
  state: ReviewState,
  entity: { label: string } | undefined,
  period: string,
): string {
  const level = effectiveLevel(state);
  if (state.source === 'used') return t('review.headline.used', { period });
  if (level !== 'area') return t(`review.headline.${level}`, { period });
  return entity
    ? t('review.headline.areaEntity', { entity: displayName(entity.label), period })
    : t('review.headline.area', { period });
}
