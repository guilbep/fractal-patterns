// Tile size presets for the Pattern tab, in px; all sit inside the slider range 40 to 320.
export const SIZE_PRESETS = [64, 96, 128, 192, 256] as const;
export const SIZE_MIN = 40;
export const SIZE_MAX = 320;

// The preset equal to `size`, or null when the slider holds a size that matches no preset.
export const markedPreset = (size: number): number | null => SIZE_PRESETS.find((p) => p === size) ?? null;
