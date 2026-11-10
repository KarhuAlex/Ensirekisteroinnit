import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRobots,
  buildSitemap,
  emptySitemap,
  normalizeBase,
  pagePaths,
  sitemapEntityIds,
} from './seo.mjs';

// Writes sitemap.xml and robots.txt into the build folder from the site address, so each publisher
// gets files for their own domain. Without SITE_URL the robots.txt has no sitemap line and the
// sitemap is empty, so a file from an earlier deploy cannot go stale.
// Usage: SITE_URL=https://example.org DATA_BASE_URL=... node apps/web/scripts/write-seo-files.mjs [dist]

const FETCH_TIMEOUT_MS = 15_000;
const dataBase = process.env.DATA_BASE_URL?.replace(/\/+$/, '');

async function readJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** Ids of the makes and models in the latest release, or none when the data cannot be read. */
async function entityIds() {
  if (!dataBase) return [];
  try {
    const { release } = await readJson(`${dataBase}/latest.json`);
    const entities = await readJson(`${dataBase}/${release}/entities.json`);
    return sitemapEntityIds(entities);
  } catch (error) {
    console.warn(`Model pages left out of the sitemap: ${error.message}`);
    return [];
  }
}

function writeSeoFiles(outDir, { robots, sitemap }) {
  writeFileSync(join(outDir, 'robots.txt'), robots);
  writeFileSync(join(outDir, 'sitemap.xml'), sitemap);
}

async function main() {
  const outDir = process.argv[2] ?? 'dist';
  const siteUrl = process.env.SITE_URL;

  if (!siteUrl) {
    writeSeoFiles(outDir, { robots: buildRobots(null), sitemap: emptySitemap() });
    console.log(
      'SITE_URL is not set: wrote robots.txt without a sitemap line and an empty sitemap.',
    );
    return;
  }
  const base = normalizeBase(siteUrl);
  const paths = pagePaths(await entityIds());
  writeSeoFiles(outDir, { robots: buildRobots(base), sitemap: buildSitemap(base, paths) });
  console.log(
    `Wrote sitemap.xml (${paths.length} pages in each language) and robots.txt for ${base}.`,
  );
}

await main();
