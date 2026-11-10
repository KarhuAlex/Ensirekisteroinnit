import { Link } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { reviewPath } from '../lib/reviewState';

/** A table period (a month or a year) as a link to the review of that period. */
export function PeriodLink({ period, monthly }: { period: string; monthly: boolean }) {
  const { lang, t, fmt } = useI18n();
  const { manifest } = useCatalog();
  const path = reviewPath(lang, manifest.months, period);
  // Months are written out as in the review heading; a year stays as it is.
  const label = monthly ? fmt.month(period) : period;
  if (!path) return <>{label}</>;
  const hint = t('table.openReview', { period: label });
  return (
    <Link to={path} title={hint} aria-label={hint}>
      {label}
    </Link>
  );
}
