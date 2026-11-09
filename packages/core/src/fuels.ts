/**
 * Canonical fuel types. Source adapters map their own classification to these ids, so nothing
 * downstream depends on one provider's codes.
 */
export const FUEL_IDS = [
  'petrol',
  'diesel',
  'bev',
  'cng',
  'petrol_cng',
  'phev_petrol',
  'petrol_ethanol',
  'phev_diesel',
  'other',
] as const;

export type FuelId = (typeof FUEL_IDS)[number];

/** Coarser groups for charts, where nine categories would be unreadable. */
export const FUEL_GROUP_IDS = ['petrol', 'diesel', 'bev', 'phev', 'other'] as const;

export type FuelGroupId = (typeof FUEL_GROUP_IDS)[number];

export const FUEL_GROUP_OF: Readonly<Record<FuelId, FuelGroupId>> = {
  petrol: 'petrol',
  diesel: 'diesel',
  bev: 'bev',
  cng: 'other',
  petrol_cng: 'other',
  phev_petrol: 'phev',
  petrol_ethanol: 'other',
  phev_diesel: 'phev',
  other: 'other',
};
