// The pattern library tabs: one per family, then 'all'.
import { FAMILIES, KINDS, KIND_FAMILY, type Family, type Kind } from './fractal.ts';

export type LibTab = Family | 'all';
export const LIB_TABS: readonly LibTab[] = [...FAMILIES, 'all'];

// The open tab follows the kind unless it already shows it.
export function tabForKind(open: LibTab, kind: Kind): LibTab {
  return open === 'all' || KIND_FAMILY[kind] === open ? open : KIND_FAMILY[kind];
}

// Kinds of a tab in family order (the order of FAMILIES, then of KINDS).
export function kindsForTab(tab: LibTab): Kind[] {
  const fams = tab === 'all' ? FAMILIES : [tab];
  return fams.flatMap((f) => KINDS.filter((k) => KIND_FAMILY[k] === f));
}

// A stored tab value; anything unknown falls back to the family of the kind.
export function parseLibTab(value: string | null, kind: Kind): LibTab {
  return LIB_TABS.find((t) => t === value) ?? KIND_FAMILY[kind];
}
