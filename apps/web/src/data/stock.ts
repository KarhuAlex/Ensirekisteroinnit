import type { CarStock } from '@regs/core';
import { loadStock } from './api';
import { once, useRemote, type Remote } from './remote';

const loadStockOnce = once(loadStock);

export const useStock = (): Remote<CarStock> => useRemote(loadStockOnce);
