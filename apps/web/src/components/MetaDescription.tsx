import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { setMetaDescription } from '../lib/metaDescription';

/** Keeps the page's description in the language of the page. Renders nothing. */
export function MetaDescription() {
  const { t } = useI18n();
  const description = t('meta.description');

  useEffect(() => setMetaDescription(description), [description]);

  return null;
}
