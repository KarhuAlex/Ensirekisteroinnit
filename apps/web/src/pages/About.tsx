import { PageHeader, usePageTitle } from '../components/ui';
import { useCatalog } from '../data/DataProvider';
import { useI18n } from '../i18n';

export function About() {
  const { t, fmt } = useI18n();
  const { manifest } = useCatalog();
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
        </ul>
      </section>

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
