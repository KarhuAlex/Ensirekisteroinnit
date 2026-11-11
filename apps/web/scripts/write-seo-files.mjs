import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRobots,
  buildSitemap,
  emptySitemap,
  normalizeBase,
  pagePaths,
  releaseDay,
  sitemapEntityIds,
  withHeadTags,
} from './seo.mjs';

// Writes sitemap.xml and robots.txt into the build folder, and adds sharing and structured data
// tags to its index.html, from the site address, so each publisher
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

/** The makes and models of the latest release and the day it was published; none if unreadable. */
async function readCatalog() {
  if (!dataBase) return { ids: [] };
  try {
    const { release, generatedAt } = await readJson(`${dataBase}/latest.json`);
    const entities = await readJson(`${dataBase}/${release}/entities.json`);
    return { ids: sitemapEntityIds(entities), lastmod: releaseDay(generatedAt) };
  } catch (error) {
    console.warn(`Model pages left out of the sitemap: ${error.message}`);
    return { ids: [] };
  }
}

/** Adds the sharing and structured data tags to the page every URL is served from. */
function writeHeadTags(outDir, base) {
  const file = join(outDir, 'index.html');
  if (!existsSync(file)) return console.warn(`No ${file} to add head tags to.`);
  writeFileSync(file, withHeadTags(readFileSync(file, 'utf8'), base));
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
  const { ids, lastmod } = await readCatalog();
  const paths = pagePaths(ids);
  writeSeoFiles(outDir, { robots: buildRobots(base), sitemap: buildSitemap(base, paths, lastmod) });
  writeHeadTags(outDir, base);
  console.log(
    `Wrote sitemap.xml (${paths.length} pages in each language), robots.txt and head tags for ${base}.`,
  );
}

await main();
