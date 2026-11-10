/** Details of whoever publishes the site. They live in `site.config.json`, outside the build. */
export interface SiteConfig {
  operator?: string;
  contactUrl?: string;
  hosting?: string;
  repoUrl?: string;
  /** The public address of the site, used for canonical links. */
  siteUrl?: string;
}

const MAX_TEXT_LENGTH = 100;

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT_LENGTH ? trimmed : undefined;
}

/** Only http and https links are accepted, so the file cannot inject a `javascript:` link. */
function link(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function parseSiteConfig(input: unknown): SiteConfig {
  if (typeof input !== 'object' || input === null) return {};
  const raw = input as Record<string, unknown>;
  const config: SiteConfig = {};
  const operator = text(raw['operator']);
  const hosting = text(raw['hosting']);
  const contactUrl = link(raw['contactUrl']);
  const repoUrl = link(raw['repoUrl']);
  const siteUrl = link(raw['siteUrl']);
  if (operator) config.operator = operator;
  if (hosting) config.hosting = hosting;
  if (contactUrl) config.contactUrl = contactUrl;
  if (repoUrl) config.repoUrl = repoUrl;
  if (siteUrl) config.siteUrl = new URL(siteUrl).origin;
  return config;
}

export async function loadSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch('/site.config.json', { cache: 'no-cache' });
    return res.ok ? parseSiteConfig(await res.json()) : {};
  } catch {
    return {};
  }
}
