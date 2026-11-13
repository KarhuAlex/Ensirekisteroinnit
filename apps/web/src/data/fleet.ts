import type { CarFleet, CarFleetCells } from '@regs/core';
import { loadFleet, loadFleetCells, loadFleetPointer } from './api';
import { once, oncePerKey, useRemote, type Remote } from './remote';

const loadFleetOnce = once(loadFleet);

export const useFleet = (): Remote<CarFleet> => useRemote(loadFleetOnce);

const loadPointerOnce = once(loadFleetPointer);

/** True once a snapshot is published, which costs one small request; links to the page wait for it. */
export const useFleetPublished = (): boolean => useRemote(loadPointerOnce).status === 'ready';

const loadCellsOnce = oncePerKey(loadFleetCells, (release) => release);
// One release at a time is in use, so a load per release is kept for the page visit.
const cellsLoads = new Map<string, () => Promise<CarFleetCells>>();

function cellsLoad(release: string): () => Promise<CarFleetCells> {
  let load = cellsLoads.get(release);
  if (!load) {
    load = () => loadCellsOnce(release);
    cellsLoads.set(release, load);
  }
  return load;
}

/**
 * The cars of each make in each municipality in a release. They are a larger file than the rest, so
 * nothing is fetched until `wanted`, which is when a make has been chosen.
 */
export const useFleetCells = (release: string, wanted: boolean): Remote<CarFleetCells> =>
  useRemote(wanted ? cellsLoad(release) : null);
