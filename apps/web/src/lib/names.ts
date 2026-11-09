/** Tokens this short stay upper case: acronyms such as KIA, MG or DS. */
const KEEP_UPPER_MAX = 3;

function titleToken(token: string): string {
  if (token.length <= KEEP_UPPER_MAX || /\d/.test(token)) return token.toUpperCase();
  return token
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

/**
 * The source writes labels in capitals. Lists and headings read better title-cased, with short
 * tokens and tokens containing digits (model codes) kept upper case. The original label stays
 * the search key.
 */
export function displayName(label: string): string {
  return label.trim().split(/\s+/).map(titleToken).join(' ');
}
