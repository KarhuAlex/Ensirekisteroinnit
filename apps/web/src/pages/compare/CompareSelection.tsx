import type { EntitySummary } from '@regs/core';
import { EntityPicker } from '../../components/EntityPicker';
import { useI18n } from '../../i18n';
import { MAX_COMPARED } from '../../lib/comparison';
import type { EntityLevel } from '../../lib/entityLevel';
import { ChosenList } from './ChosenList';
import { LevelChoice } from './LevelChoice';

interface Props {
  chosen: EntitySummary[];
  /** Items that can still be added; the first item's level only, unless mixed levels are allowed. */
  candidates: EntitySummary[];
  level: EntityLevel | null;
  allowMixedLevels: boolean;
  onAllowMixedLevelsChange: (allow: boolean) => void;
  slots: ReadonlyMap<string, number>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

/** The chosen items, a field to add another, and the choice to mix levels. */
export function CompareSelection({
  chosen,
  candidates,
  level,
  allowMixedLevels,
  onAllowMixedLevelsChange,
  slots,
  onAdd,
  onRemove,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="compare-controls">
      {chosen.length > 0 && <ChosenList chosen={chosen} slots={slots} onRemove={onRemove} />}
      {chosen.length >= MAX_COMPARED ? (
        <p className="muted">{t('compare.full', { n: MAX_COMPARED })}</p>
      ) : (
        <EntityPicker
          // Changing the key clears the field, since typed text may not match the new list.
          key={`${chosen.length}-${allowMixedLevels}`}
          entities={candidates}
          value={null}
          onChange={(id) => id && onAdd(id)}
          label={t('compare.add')}
          placeholder={t('compare.addPlaceholder')}
        />
      )}
      <LevelChoice
        level={level}
        allowMixedLevels={allowMixedLevels}
        onChange={onAllowMixedLevelsChange}
      />
    </div>
  );
}
