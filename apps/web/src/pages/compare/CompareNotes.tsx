import { useI18n } from '../../i18n';
import { MIN_SHARE_BASE } from '../../lib/comparison';
import type { EntityLevel } from '../../lib/entityLevel';

interface Props {
  dropped: number;
  chosen: number;
  level: EntityLevel | null;
}

/** What to keep in mind when reading a comparison, and what the address asked for in vain. */
export function CompareNotes({ dropped, chosen, level }: Props) {
  const { t } = useI18n();
  return (
    <>
      {chosen === 1 && <p className="footnote">{t('compare.one')}</p>}
      {dropped > 0 && <p className="footnote">{t('compare.dropped', { n: dropped })}</p>}
      {chosen > 0 && (
        <p className="footnote">
          {t('compare.note', { min: MIN_SHARE_BASE })}
          {level === 'corporategroup' && ` ${t('compare.note.corporategroup')}`}
        </p>
      )}
    </>
  );
}
