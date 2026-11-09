import { Link } from 'react-router-dom';
import { StatusPanel, usePageTitle } from '../components/ui';
import { useI18n } from '../i18n';

export function NotFound() {
  const { lang, t } = useI18n();
  usePageTitle(`${t('notfound.title')} – ${t('app.title')}`);
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
