import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';

/**
 * The place under a map where the chosen area's figures appear. It is a live region that stays in
 * the page whether or not an area is chosen, so that choosing one announces its figures.
 */
export function AreaCardFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div aria-live="polite">{children || <p className="muted">{t('fleet.card.hint')}</p>}</div>
  );
}
