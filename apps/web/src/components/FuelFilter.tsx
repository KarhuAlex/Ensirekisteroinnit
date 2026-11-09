import { FUEL_GROUP_IDS, type FuelGroupId } from '@regs/core';
import { nextFuels } from '../lib/fuelSelection';
import { useI18n } from '../i18n';
import { STACK_ORDER } from '../lib/stats';
import { FuelMark } from './FuelMark';

export function FuelFilter({
  fuels,
  onChange,
}: {
  fuels: readonly FuelGroupId[];
  onChange: (fuels: FuelGroupId[]) => void;
}) {
  const { t } = useI18n();
  const all = fuels.length === FUEL_GROUP_IDS.length;
  return (
    <div className="fuel-filter" role="group" aria-label={t('review.fuels')}>
      <ul className="plates">
        {STACK_ORDER.map((group) => (
          <li key={group}>
            <button
              type="button"
              className="plate-button"
              aria-pressed={all || fuels.includes(group)}
              onClick={() => onChange(nextFuels(fuels, group))}
            >
              <FuelMark group={group} />
              <span className="plate-name">{t(`fuel.group.${group}`)}</span>
            </button>
          </li>
        ))}
        {!all && (
          <li>
            <button type="button" className="button" onClick={() => onChange([...FUEL_GROUP_IDS])}>
              {t('review.fuelsAll')}
            </button>
          </li>
        )}
      </ul>
      <p className="muted hint">{t('review.fuelsHint')}</p>
    </div>
  );
}
