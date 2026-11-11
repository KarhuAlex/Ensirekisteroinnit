import type { CarStock } from '@regs/core';
import { useMemo } from 'react';
import { useStock } from '../data/stock';
import { useI18n } from '../i18n';
import { stockShares } from '../lib/stock';
import { RollingChart } from './RollingChart';
import { SourceCredit } from './SourceCredit';
import { Section, StatusPanel } from './ui';

const CHART_HEIGHT = 300;

/** The electric share of the cars in traffic, apart from the registrations. Nothing shows until published. */
export function StockSection() {
  const { t } = useI18n();
  const stock = useStock();

  if (stock.status === 'error') {
    return <StatusPanel tone="error" title={t('status.error')} hint={t('status.errorHint')} />;
  }
  if (stock.status !== 'ready') return null;
  return <StockPanel stock={stock.data} />;
}

function StockPanel({ stock }: { stock: CarStock }) {
  const { t } = useI18n();
  const shares = useMemo(() => stockShares(stock), [stock]);

  return (
    <Section
      id="stock-title"
      title={t('stock.title')}
      footnote={
        <>
          {t('stock.note')} <SourceCredit source={stock.source} message="stock.source" />
        </>
      }
    >
      <RollingChart
        months={shares.periods}
        bev={shares.bev}
        plugIn={shares.plugIn}
        quarterly
        height={CHART_HEIGHT}
        ariaLabel={t('stock.aria')}
      />
    </Section>
  );
}
