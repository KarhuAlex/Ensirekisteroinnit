import { useCallback, useMemo } from 'react';
import { useI18n } from '../i18n';
import { markIncompleteYear } from '../lib/stats';
import { useCatalog } from './DataProvider';

export function useTimeAxis() {
  const { manifest } = useCatalog();
  const { fmt } = useI18n();
  const monthLabels = useMemo(
    () => manifest.months.map((m) => fmt.month(m)),
    [manifest.months, fmt],
  );
  const incompleteYear = !manifest.latestMonth.endsWith('-12');
  const yearLabels = useCallback(
    (years: readonly string[]) => markIncompleteYear(years, incompleteYear),
    [incompleteYear],
  );
  return {
    months: manifest.months,
    monthLabels,
    latestMonthLabel: fmt.month(manifest.latestMonth),
    incompleteYear,
    yearLabels,
  };
}
