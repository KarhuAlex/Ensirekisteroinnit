import { useI18n } from '../../i18n';
import { Icon } from '../Icon';

/** Empties a text field. It does not take the focus, so the list under the field stays open. */
export function ClearButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="input-clear"
      aria-label={t('search.clear')}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon name="close" size={18} />
    </button>
  );
}
