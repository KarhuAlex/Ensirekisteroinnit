import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRobots,
  buildSitemap,
  emptySitemap,
  hasHeadTags,
  normalizeBase,
  pageFolders,
  pagePaths,
  releaseDay,
  sitemapEntityIds,
  withHeadTags,
} from './seo.mjs';

// Writes the files that depend on the site address into the build folder: sitemap.xml, robots.txt,
// the sharing and structured data tags, and an HTML file for every fixed page and every make and
// model page. With SITE_URL set, the latest release must be readable, or the script fails, so a deploy
// never uploads a new app beside page files from an older one. Without SITE_URL, robots.txt has no
// sitemap line, the sitemap is empty and no page files are written. The upload never deletes, so
// page files from an earlier deploy stay until someone removes them.
// Run it once after `npm run build -w @regs/web`, which also bundles the page builder.
// Usage: SITE_URL=https://example.org DATA_BASE_URL=... node apps/web/scripts/write-seo-files.mjs [dist]

const FETCH_TIMEOUT_MS = 15_000;
const dataBase = process.env.DATA_BASE_URL?.replace(/\/+$/, '');
const PRERENDER_URL = new URL('../dist-node/prerender.js', import.meta.url);
const PRERENDER_MODULE = fileURLToPath(PRERENDER_URL);

async function readJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** The manifest and the makes and models of the latest release, and the day it was published. */
async function readCatalog() {
  if (!dataBase)
    throw new Error('DATA_BASE_URL is not set: the page files need the latest release.');
  const { release, generatedAt } = await readJson(`${dataBase}/latest.json`);
  const [manifest, entities] = await Promise.all([
    readJson(`${dataBase}/${release}/manifest.json`),
    readJson(`${dataBase}/${release}/entities.json`),
  ]);
  return { manifest, entities, lastmod: releaseDay(generatedAt) };
}

/** The built index.html, which every page is made from; refused if this script already ran. */
function readTemplate(outDir) {
  const file = join(outDir, 'index.html');
  if (!existsSync(file)) throw new Error(`No ${file}: build the web app first.`);
  const html = readFileSync(file, 'utf8');
  if (hasHeadTags(html)) {
    throw new Error(`${file} already has head tags: run this once after a fresh build.`);
  }
  return html;
}

/** One index.html per address, so the storage website answers each one with status 200. */
async function writePages(outDir, base, template, catalog) {
  if (!existsSync(PRERENDER_MODULE)) {
    throw new Error(`No ${PRERENDER_MODULE}: run npm run build -w @regs/web first.`);
  }
  const { prerenderPages } = await import(PRERENDER_URL.href);
  const pages = prerenderPages({ template, base, ...catalog });
  for (const page of pages) {
    const file = join(outDir, ...pageFolders(page.path), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, withHeadTags(page.html, base, { structuredData: page.home }));
  }
  return pages.length;
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
  const template = readTemplate(outDir);
  const { manifest, entities, lastmod } = await readCatalog();
  const paths = pagePaths(sitemapEntityIds(entities));
  const pageCount = await writePages(outDir, base, template, { manifest, entities });
  writeSeoFiles(outDir, { robots: buildRobots(base), sitemap: buildSitemap(base, paths, lastmod) });
  writeFileSync(join(outDir, 'index.html'), withHeadTags(template, base));
  console.log(
    `Wrote sitemap.xml (${paths.length} pages in each language), ${pageCount} page files, robots.txt and head tags for ${base}.`,
  );
}

await main();
