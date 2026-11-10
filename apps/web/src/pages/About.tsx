import { PageHeader, usePageTitle } from '../components/ui';
import { useCatalog } from '../data/DataProvider';
import { useSiteConfig } from '../data/SiteConfigProvider';
import { useI18n } from '../i18n';

export function About() {
  const { t, fmt } = useI18n();
  const { manifest } = useCatalog();
  const { config, ready } = useSiteConfig();
  usePageTitle(`${t('about.title')} – ${t('app.title')}`);
  const { source } = manifest;

  return (
    <article className="prose">
      <PageHeader title={t('about.title')} lede={t('about.intro')} />

      <section className="block" aria-labelledby="about-source">
        <h2 id="about-source">{t('about.sourceTitle')}</h2>
        <p>
          {t('about.sourceText', {
            name: source.name,
            licence: source.licence,
            updated: fmt.date(source.updated),
            generated: fmt.date(manifest.generatedAt),
          })}
        </p>
        <p>
          <a href={source.url} rel="noopener noreferrer" target="_blank">
            {t('about.sourceLink')}
          </a>
        </p>
      </section>

      <section className="block" aria-labelledby="about-caveats">
        <h2 id="about-caveats">{t('about.caveatsTitle')}</h2>
        <ul>
          <li>{t('about.caveat1')}</li>
          <li>{t('about.caveat2')}</li>
          <li>{t('about.caveat3')}</li>
          <li>{t('about.caveat4')}</li>
          <li>{t('about.caveat5')}</li>
          <li>{t('about.caveat6')}</li>
        </ul>
      </section>

      <section className="block" aria-labelledby="about-privacy">
        <h2 id="about-privacy">{t('about.privacyTitle')}</h2>
        <p>{t('about.privacyText')}</p>
        {ready && (
          <p>
            {config.operator && `${t('about.privacyOperator', { operator: config.operator })} `}
            {config.hosting
              ? t('about.privacyHosting', { hosting: config.hosting })
              : t('about.privacyHostingGeneric')}
          </p>
        )}
      </section>

      <section className="block" aria-labelledby="about-disclaimer">
        <h2 id="about-disclaimer">{t('about.disclaimerTitle')}</h2>
        <p>{t('about.disclaimerText')}</p>
      </section>

      {ready && (config.contactUrl || config.repoUrl) && (
        <section className="block" aria-labelledby="about-contact">
          <h2 id="about-contact">{t('about.contactTitle')}</h2>
          {config.contactUrl && (
            <p>
              {t('about.contactText')}{' '}
              <a href={config.contactUrl} rel="noopener noreferrer" target="_blank">
                {t('about.contactLink')}
              </a>
            </p>
          )}
          {config.repoUrl && (
            <p>
              {t('about.repoText')}{' '}
              <a href={config.repoUrl} rel="noopener noreferrer" target="_blank">
                {t('about.repoLink')}
              </a>
            </p>
          )}
        </section>
      )}

      {manifest.notes.length > 0 && (
        <section className="block" aria-labelledby="about-notes">
          <h2 id="about-notes">{t('about.sourceNotesTitle')}</h2>
          <ul>
            {manifest.notes.map((note) => (
              <li key={note} lang="fi">
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
