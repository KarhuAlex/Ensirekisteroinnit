import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

interface Props {
  searchLabel: string;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onDownload?: () => void;
  canDownload?: boolean;
  countText: string;
  /** Extra controls, shown between the search field and the download button. */
  children?: ReactNode;
}

export function TableToolbar({
  searchLabel,
  placeholder,
  query,
  onQueryChange,
  onDownload,
  canDownload = true,
  countText,
  children,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="toolbar">
      <label className="field">
        <span>{searchLabel}</span>
        <span className="field-input">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </span>
      </label>
      {children}
      {onDownload && (
        <button type="button" className="button" disabled={!canDownload} onClick={onDownload}>
          <Icon name="download" size={18} />
          {t('table.download')}
        </button>
      )}
      <span className="muted count" aria-live="polite">
        {countText}
      </span>
    </div>
  );
}
