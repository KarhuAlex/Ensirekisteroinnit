import type { useI18n } from '../../i18n';
import type { AreaMetric } from '../../lib/reviewState';

export type Translate = ReturnType<typeof useI18n>['t'];
export type Formatters = ReturnType<typeof useI18n>['fmt'];

export function formatMetric(
  value: number,
  metric: AreaMetric,
  t: Translate,
  fmt: Formatters,
): string {
  if (metric === 'share') return fmt.pct(value);
  if (metric === 'change') return fmt.signed(value, ` ${t('unit.pp')}`);
  return fmt.int(Math.round(value));
}
