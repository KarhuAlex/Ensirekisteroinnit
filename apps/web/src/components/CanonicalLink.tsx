import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteConfig } from '../data/SiteConfigProvider';
import { canonicalHref, setCanonicalLink } from '../lib/canonical';

/**
 * Keeps the page's canonical link in step with the route. Renders nothing. Until the site address
 * has been read, the link the page was served with stays as it is.
 */
export function CanonicalLink() {
  const { config, ready } = useSiteConfig();
  const { pathname } = useLocation();
  const href = canonicalHref(config.siteUrl, pathname);

  useEffect(() => {
    if (ready) setCanonicalLink(href);
  }, [ready, href]);

  return null;
}
