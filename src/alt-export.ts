// When the canvas script and the paint worklet can draw the current design. Pure.
export interface AltInput {
  readonly curves: boolean; // an image tile with Smooth curves on
  readonly extra: string; // the kind's raw path (Penrose arcs), '' for most kinds
  readonly variants: boolean; // Reduce repetition: the super tile uses <use>
  readonly layer2: boolean;
}

// null when available, else the reason in plain words.
export function altUnavailable(i: AltInput): string | null {
  if (i.curves) return 'Smooth curves are on; the canvas draws straight lines only.';
  if (i.extra) return 'this pattern draws arcs; the canvas draws straight lines only.';
  if (i.variants) return 'Reduce repetition is on; the canvas draws one plain tile.';
  if (i.layer2) return 'a second layer is on; the canvas draws one layer.';
  return null;
}
