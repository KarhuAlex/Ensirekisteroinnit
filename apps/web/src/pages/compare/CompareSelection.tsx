import type { EntitySummary } from '@regs/core';
import { EntityPicker } from '../../components/EntityPicker';
import { Icon } from '../../components/Icon';
import { SeriesMark } from '../../components/SeriesMark';
import { useI18n } from '../../i18n';
import { MAX_COMPARED } from '../../lib/comparison';
import type { EntityLevel } from '../../lib/entityLevel';
import { displayName } from '../../lib/names';

interface Props {
  chosen: EntitySummary[];
  /** What can still be added: things on the level of the first one chosen. */
  candidates: EntitySummary[];
  level: EntityLevel | null;
  slots: ReadonlyMap<string, number>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

/** What is being compared, and a field to add one more of the same level. */
export function CompareSelection({ chosen, candidates, level, slots, onAdd, onRemove }: Props) {
  const { t } = useI18n();
  const full = chosen.length >= MAX_COMPARED;

  return (
    <div className="compare-controls">
      {chosen.length > 0 && (
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
      )}
      {full ? (
        <p className="muted">{t('compare.full', { n: MAX_COMPARED })}</p>
      ) : (
        <>
          <EntityPicker
            key={chosen.length}
            entities={candidates}
            value={null}
            onChange={(id) => id && onAdd(id)}
            label={t('compare.add')}
            placeholder={t('compare.addPlaceholder')}
          />
          {level && (
            <p className="muted hint">
              {t('compare.sameLevel', { level: t(`review.level.${level}`).toLowerCase() })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
