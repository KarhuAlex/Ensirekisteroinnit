import type { FuelPrices } from '@regs/core';
import { useI18n } from '../i18n';

/** The credit the price data's licence asks for: who published it, under what licence, and when. */
export function PriceSource({ source }: { source: FuelPrices['source'] }) {
  const { t, fmt } = useI18n();
  return (
    <>
      {t('prices.source', {
        name: source.name,
        licence: source.licence,
        updated: fmt.date(source.updated),
      })}
    </>
  );
}
