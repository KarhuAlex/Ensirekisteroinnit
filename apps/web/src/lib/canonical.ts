/**
 * The address search engines should treat as the page's own: the site address plus the path, without
 * the query string or hash, so the many views of the review page all point at one URL.
 */
export function canonicalHref(siteUrl: string | undefined, pathname: string): string | null {
  if (!siteUrl) return null;
  const path = pathname.replace(/\/+$/, '');
  return `${siteUrl}${path}`;
}

/** Sets the page's canonical link in the document head, or removes it when there is none. */
export function setCanonicalLink(href: string | null): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}
