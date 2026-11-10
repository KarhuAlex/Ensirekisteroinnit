import { useI18n } from '../../i18n';
import { noteFlags } from '../../lib/compareNotes';
import { MIN_SHARE_BASE } from '../../lib/comparison';

interface Props {
  dropped: number;
  chosen: number;
  mixedLevels: boolean;
  hasCorporateGroup: boolean;
}

/** Notes on reading the comparison, and on items the address named that were dropped. */
export function CompareNotes({ dropped, chosen, mixedLevels, hasCorporateGroup }: Props) {
  const { t } = useI18n();
  const flags = noteFlags({ dropped, chosen, mixedLevels, hasCorporateGroup });
  return (
    <>
      {flags.askForAnother && <p className="footnote">{t('compare.one')}</p>}
      {flags.droppedItems && <p className="footnote">{t('compare.dropped', { n: dropped })}</p>}
      {flags.reading && (
        <p className="footnote">
          {t('compare.note', { min: MIN_SHARE_BASE })}
          {flags.overlap && ` ${t('compare.note.mixed')}`}
          {flags.ownership && ` ${t('compare.note.corporategroup')}`}
        </p>
      )}
    </>
  );
}
