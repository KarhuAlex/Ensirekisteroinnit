import type { CarFleet } from '@regs/core';
import { loadFleet, loadFleetPointer } from './api';
import { once, useRemote, type Remote } from './remote';

const loadFleetOnce = once(loadFleet);

export const useFleet = (): Remote<CarFleet> => useRemote(loadFleetOnce);

const loadPointerOnce = once(loadFleetPointer);

/** True once a snapshot is published, which costs one small request; links to the page wait for it. */
export const useFleetPublished = (): boolean => useRemote(loadPointerOnce).status === 'ready';
