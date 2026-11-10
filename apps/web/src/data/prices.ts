import type { FuelPrices } from '@regs/core';
import { loadPrices } from './api';
import { once, useRemote, type Remote } from './remote';

const loadPricesOnce = once(loadPrices);

export const usePrices = (): Remote<FuelPrices> => useRemote(loadPricesOnce);
