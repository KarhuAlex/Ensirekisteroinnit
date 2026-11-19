import { Link } from 'react-router-dom';
import { StatusPanel, usePageHead } from '../components/ui';
import { useI18n } from '../i18n';

export function NotFound() {
  const { lang, t } = useI18n();
  usePageHead({ page: 'notFound' });
  return (
    <StatusPanel
      title={t('notfound.title')}
      action={
        <Link className="button button--primary" to={`/${lang}`}>
          {t('notfound.link')}
        </Link>
      }
    />
  );
}
