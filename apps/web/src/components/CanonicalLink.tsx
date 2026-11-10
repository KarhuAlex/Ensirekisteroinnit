import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteConfig } from '../data/SiteConfigProvider';
import { canonicalHref, setCanonicalLink } from '../lib/canonical';

/** Keeps the page's canonical link in step with the route. Renders nothing. */
export function CanonicalLink() {
  const { config } = useSiteConfig();
  const { pathname } = useLocation();
  const href = canonicalHref(config.siteUrl, pathname);

  useEffect(() => setCanonicalLink(href), [href]);

  return null;
}
