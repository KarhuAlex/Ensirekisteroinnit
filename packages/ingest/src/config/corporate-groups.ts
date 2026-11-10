/**
 * Which makes belong to which corporate group. The source has no such level, so this is kept by
 * hand. It follows today's ownership and is applied to the whole history, so a make is shown under
 * its current owner even for years when it belonged to another one.
 *
 * Makes are named by their ids in the data. A make that is missing from the mapping and still
 * sells cars is reported at ingest, which is the prompt to add it here.
 */
export interface CorporateGroupDef {
  /** The published entity id is this with the `cg-` prefix. */
  id: string;
  label: string;
  makes: readonly string[];
}

export interface CorporateGroupMapping {
  /** When the ownership was last checked, `YYYY-MM`. */
  asOf: string;
  groups: readonly CorporateGroupDef[];
  /** Makes left out on purpose, so they are not reported as missing. */
  ignored: readonly string[];
}

export const CORPORATE_GROUPS: CorporateGroupMapping = {
  asOf: '2026-11',
  groups: [
    { id: 'toyota', label: 'Toyota Group', makes: ['toyota', 'lexus'] },
    {
      id: 'volkswagen',
      label: 'Volkswagen Group',
      makes: ['volkswagen', 'skoda', 'audi', 'cupra', 'seat', 'porsche', 'bentley', 'lamborghini'],
    },
    { id: 'geely', label: 'Geely Holding', makes: ['volvo', 'polestar', 'smart'] },
    { id: 'hyundai', label: 'Hyundai Motor Group', makes: ['hyundai', 'kia'] },
    {
      id: 'stellantis',
      label: 'Stellantis',
      makes: [
        'peugeot',
        'citroen',
        'opel',
        'ds',
        'fiat',
        'jeep',
        'alfa-romeo',
        'lancia',
        'maserati',
      ],
    },
    { id: 'bmw', label: 'BMW Group', makes: ['bmw', 'bmw-i', 'mini'] },
    { id: 'mercedes-benz', label: 'Mercedes-Benz Group', makes: ['mercedes-benz', 'mercedes-amg'] },
    { id: 'renault', label: 'Renault Group', makes: ['renault', 'dacia'] },
    { id: 'jaguar-land-rover', label: 'Jaguar Land Rover', makes: ['land-rover', 'jaguar'] },
    { id: 'saic', label: 'SAIC', makes: ['mg', 'maxus'] },
    { id: 'general-motors', label: 'General Motors', makes: ['chevrolet', 'cadillac'] },
    { id: 'ford', label: 'Ford', makes: ['ford'] },
    { id: 'tesla', label: 'Tesla', makes: ['tesla-motors'] },
    { id: 'nissan', label: 'Nissan', makes: ['nissan'] },
    { id: 'byd', label: 'BYD', makes: ['byd'] },
    { id: 'mazda', label: 'Mazda', makes: ['mazda'] },
    { id: 'suzuki', label: 'Suzuki', makes: ['suzuki'] },
    { id: 'subaru', label: 'Subaru', makes: ['subaru'] },
    { id: 'mitsubishi', label: 'Mitsubishi Motors', makes: ['mitsubishi'] },
    { id: 'honda', label: 'Honda', makes: ['honda'] },
    { id: 'xpeng', label: 'XPENG', makes: ['xpeng'] },
    { id: 'gac', label: 'GAC Group', makes: ['gac'] },
    { id: 'seres', label: 'Seres', makes: ['seres'] },
    { id: 'ferrari', label: 'Ferrari', makes: ['ferrari'] },
  ],
  ignored: ['matkailuautot', 'muut-merkit', 'man'],
};
