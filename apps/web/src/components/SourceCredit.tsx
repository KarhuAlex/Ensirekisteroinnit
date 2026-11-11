import { useI18n, type MessageKey } from '../i18n';

interface Props {
  source: { name: string; licence: string; updated: string };
  /** The sentence of the credit; it takes the name, the licence and the data version. */
  message: Extract<MessageKey, 'prices.source' | 'stock.source'>;
}

/** The credit a dataset's licence asks for: who published it, under what licence, and when. */
export function SourceCredit({ source, message }: Props) {
  const { t, fmt } = useI18n();
  return (
    <>
      {t(message, {
        name: source.name,
        licence: source.licence,
        updated: fmt.date(source.updated),
      })}
    </>
  );
}
