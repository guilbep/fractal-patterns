// The pattern builder model: stamps placed by hand on one repeating tile.
// The builder draws and exports through the wallpaper studio model
// (src/studio/model.ts), so both pages share the wrap and the repeat code.
import type { Repeat } from '../studio/model.ts';

/** One drawable part of a stamp, in the stamp's square box (0..box, origin top left). */
export interface StampPart {
  readonly d: string;
  readonly paint: 'fill' | 'stroke';
  /** A fill part with holes: written with fill-rule="evenodd". */
  readonly evenodd?: boolean;
  /** The part's own color, as #rrggbb. */
  readonly color: string;
}

/** A reusable drawing: a built-in shape, a studio motif, or a person's own SVG or traced image. */
export interface Stamp {
  readonly name: string;
  readonly box: number;
  readonly parts: readonly StampPart[];
}

/** One placed stamp. The center of the stamp's box sits at (x, y); the drawn side is scale * box. */
export interface Item {
  readonly id: number;
  /** Index into Design.stamps. */
  readonly stamp: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** Degrees, clockwise. */
  readonly rotate: number;
  readonly flip: boolean;
  /** 0..1. */
  readonly opacity: number;
  /** One #rrggbb color per stamp part. A missing entry means the part's own color. */
  readonly colors: readonly string[];
}

/** The repeats the builder offers: all of the studio's. */
export type BuilderRepeat = Repeat;

/** A whole design. Items are in drawing order: the last one is on top. */
export interface Design {
  readonly width: number;
  readonly height: number;
  readonly background: string | null;
  readonly repeat: BuilderRepeat;
  /** The line width of stroke parts, in tile units. */
  readonly strokeWidth: number;
  readonly stamps: readonly Stamp[];
  readonly items: readonly Item[];
  /** 'down': each row covers the row above, cyclically across the tile seam. Missing or 'none': plain list order. */
  readonly overlap?: 'none' | 'down';
}
