import { useEffect, useState } from 'react';

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

let geoPromise: Promise<Geo> | null = null;

function loadGeo(): Promise<Geo> {
  geoPromise ??= Promise.all([fetchCollection('kunta'), fetchCollection('maakunta')]).then(
    ([municipalities, regions]) => ({
      municipalities,
      regions,
      regionOfMunicipality: new Map(
        municipalities.features.map((f) => [f.properties.id, f.properties.region ?? '']),
      ),
      regionName: new Map(regions.features.map((f) => [f.properties.id, f.properties.name])),
    }),
  );
  geoPromise.catch(() => (geoPromise = null));
  return geoPromise;
}

/** Boundaries and the municipality-to-region mapping, loaded once when an area view needs them. */
export function useGeo(): { geo: Geo | null; error: Error | null } {
  const [state, setState] = useState<{ geo: Geo | null; error: Error | null }>({
    geo: null,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    loadGeo().then(
      (geo) => !cancelled && setState({ geo, error: null }),
      (error: unknown) =>
        !cancelled &&
        setState({ geo: null, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
