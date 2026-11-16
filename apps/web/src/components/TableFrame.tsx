import { useId, type ReactNode } from 'react';

/**
 * The frame of every data table: a keyboard-scrollable region named by the table's caption.
 * The first cell of each body row should be a `<th scope="row">`; it stays in view while the
 * table scrolls sideways.
 */
export function TableFrame({ caption, children }: { caption: string; children: ReactNode }) {
  const captionId = useId();
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-labelledby={captionId}>
      <table className="data-table">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}
