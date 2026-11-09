import type { FuelGroupId } from '@regs/core';
import { useI18n } from '../i18n';
import { percent, STACK_ORDER } from '../lib/stats';

export function FuelMix({ mix }: { mix: Record<FuelGroupId, number> }) {
  const { t, fmt } = useI18n();
  const total = STACK_ORDER.reduce((sum, group) => sum + mix[group], 0);
  const parts = STACK_ORDER.filter((group) => mix[group] > 0);
  const items = parts
    .map((group) => `${t(`fuel.group.${group}`)} ${fmt.pct(percent(mix[group], total))}`)
    .join(', ');
  return (
    <span
      className="fuel-mix"
      role="img"
      aria-label={t('review.mixLabel', { items })}
      title={items}
    >
      {parts.map((group) => (
        <span
          key={group}
          className={`fuel-mix-seg fuel-mix-seg--${group}`}
          style={{ flexGrow: mix[group] }}
        />
      ))}
    </span>
  );
}
