import type { EntitySummary } from '@regs/core';
import { Icon } from '../../components/Icon';
import { SeriesMark } from '../../components/SeriesMark';
import { useI18n } from '../../i18n';
import { displayName } from '../../lib/names';

interface Props {
  chosen: EntitySummary[];
  slots: ReadonlyMap<string, number>;
  onRemove: (id: string) => void;
}

/** The chosen items, each with its colour, kind and a remove button. */
export function ChosenList({ chosen, slots, onRemove }: Props) {
  const { t } = useI18n();
  return (
    <ul className="compare-chosen" aria-label={t('compare.chosen')}>
      {chosen.map((entity) => {
        const name = displayName(entity.label);
        return (
          <li key={entity.id}>
            <SeriesMark slot={slots.get(entity.id) ?? 0} />
            <span>{name}</span>
            <span className="muted">{t(`kind.${entity.kind}`)}</span>
            <button
              type="button"
              className="chip-remove"
              aria-label={t('compare.remove', { name })}
              onClick={() => onRemove(entity.id)}
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
