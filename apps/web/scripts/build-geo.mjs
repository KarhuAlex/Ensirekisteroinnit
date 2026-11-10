import { mkdirSync, writeFileSync } from 'node:fs';

// Builds the map files in public/geo from Statistics Finland's open boundary data (CC BY 4.0).
// Run it when the municipality division changes: node apps/web/scripts/build-geo.mjs

const WFS =
  'https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0&request=GetFeature' +
  '&outputFormat=application/json&srsName=EPSG:4326&typeNames=tilastointialueet:';
const OUT = new URL('../public/geo/', import.meta.url);
const DECIMALS = 3;

async function load(layer) {
  const res = await fetch(WFS + layer);
  if (!res.ok) throw new Error(`${layer}: HTTP ${res.status}`);
  return (await res.json()).features;
}

const round = (n) => Number(n.toFixed(DECIMALS));
const roundRing = (ring) => ring.map(([x, y]) => [round(x), round(y)]);

function simplify(geometry) {
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: geometry.coordinates.map(roundRing) }
    : { type: 'MultiPolygon', coordinates: geometry.coordinates.map((p) => p.map(roundRing)) };
}

const polygons = (geometry) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const contains = (geometry, point) =>
  polygons(geometry).some(
    ([outer, ...holes]) => insideRing(point, outer) && !holes.some((h) => insideRing(point, h)),
  );

/** The polygon's mean vertex is cheap and lands inside nearly every municipality. */
function samplePoints(geometry) {
  const ring = polygons(geometry).sort((a, b) => b[0].length - a[0].length)[0][0];
  const mean = ring.reduce((s, [x, y]) => [s[0] + x / ring.length, s[1] + y / ring.length], [0, 0]);
  return [mean, ...ring.filter((_, i) => i % Math.ceil(ring.length / 12) === 0)];
}

const [municipalities, regions] = await Promise.all([load('kunta4500k'), load('maakunta4500k')]);

function regionOf(feature) {
  const votes = new Map();
  for (const point of samplePoints(feature.geometry)) {
    const region = regions.find((r) => contains(r.geometry, point));
    if (region)
      votes.set(region.properties.maakunta, (votes.get(region.properties.maakunta) ?? 0) + 1);
  }
  const [best] = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!best) throw new Error(`No region found for ${feature.properties.nimi}`);
  return best[0];
}

const collection = (features) => ({ type: 'FeatureCollection', features });
const kunta = collection(
  municipalities.map((f) => ({
    type: 'Feature',
    properties: { id: f.properties.kunta, name: f.properties.nimi, region: regionOf(f) },
    geometry: simplify(f.geometry),
  })),
);
const maakunta = collection(
  regions.map((f) => ({
    type: 'Feature',
    properties: { id: f.properties.maakunta, name: f.properties.nimi },
    geometry: simplify(f.geometry),
  })),
);

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('kunta.geo.json', OUT), JSON.stringify(kunta));
writeFileSync(new URL('maakunta.geo.json', OUT), JSON.stringify(maakunta));
console.log(`municipalities ${kunta.features.length}, regions ${maakunta.features.length}`);
const perRegion = new Map();
for (const f of kunta.features)
  perRegion.set(f.properties.region, (perRegion.get(f.properties.region) ?? 0) + 1);
console.log([...perRegion.entries()].map(([id, n]) => `${id}:${n}`).join(' '));
