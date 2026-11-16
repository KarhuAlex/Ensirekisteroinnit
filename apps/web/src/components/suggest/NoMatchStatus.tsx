import { useI18n } from '../../i18n';

/**
 * Tells assistive technology that a search found nothing, with the same hint the popup shows.
 * The status stays in the page next to the field, because a live region that appears together
 * with its message is not announced.
 */
export function NoMatchStatus({ empty }: { empty: boolean }) {
  const { t } = useI18n();
  return (
    <p className="sr-only" role="status">
      {empty && (
        <>
          <span>{t('search.empty')}.</span> <span>{t('search.emptyHint')}</span>
        </>
      )}
    </p>
  );
}
