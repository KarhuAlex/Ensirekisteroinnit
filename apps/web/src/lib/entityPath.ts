import type { EntityKind } from '@regs/core';
import { comparePath } from './compareState';
import { hasPage } from './entityLevel';
import type { Lang } from './format';

/** Where a link to an entity goes: its page, or the comparison if it has no page. */
export const entityPath = (lang: Lang, kind: EntityKind, id: string): string =>
  hasPage(kind) ? `/${lang}/models/${id}` : comparePath(lang, [id]);
