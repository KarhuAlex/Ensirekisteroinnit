import { once, useRemote, type Remote } from './remote';

export interface GeoFeature {
  type: 'Feature';
  properties: { id: string; name: string; region?: string };
  geometry: unknown;
}

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface Geo {
  municipalities: GeoCollection;
  regions: GeoCollection;
  /** Region id of each municipality, taken from where its boundary lies. */
  regionOfMunicipality: ReadonlyMap<string, string>;
  regionName: ReadonlyMap<string, string>;
}

async function fetchCollection(name: string): Promise<GeoCollection> {
  const res = await fetch(`/geo/${name}.geo.json`);
  if (!res.ok) throw new Error(`Map data failed to load (${res.status})`);
  return (await res.json()) as GeoCollection;
}

/** Boundaries and the municipality-to-region mapping, loaded once when an area view needs them. */
const loadGeo = once(async (): Promise<Geo> => {
  const [municipalities, regions] = await Promise.all([
    fetchCollection('kunta'),
    fetchCollection('maakunta'),
  ]);
  return {
    municipalities,
    regions,
    regionOfMunicipality: new Map(
      municipalities.features.map((f) => [f.properties.id, f.properties.region ?? '']),
    ),
    regionName: new Map(regions.features.map((f) => [f.properties.id, f.properties.name])),
  };
});

/** Nothing is fetched while `enabled` is false. */
export const useGeo = (enabled = true): Remote<Geo> => useRemote(enabled ? loadGeo : null);
