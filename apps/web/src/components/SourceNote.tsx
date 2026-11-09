import { Link } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';

export function SourceNote({ extra }: { extra?: string }) {
  const { lang, t, fmt } = useI18n();
  const { manifest } = useCatalog();
  return (
    <>
      {extra ? `${extra} ` : ''}
      {t('footer.text', {
        licence: manifest.source.licence,
        updated: fmt.date(manifest.source.updated),
      })}{' '}
      <Link to={`/${lang}/about`}>{t('footer.limits')}</Link>
    </>
  );
}
