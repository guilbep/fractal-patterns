// Edge detector ids and labels, apart from trace.ts so the page can name them without loading the tracing code.

export const DETECTORS = ['sobel', 'prewitt', 'roberts', 'laplacian', 'canny', 'scharr', 'xdog'] as const; // append only: ids are persisted
export type Detector = (typeof DETECTORS)[number];

export const DETECTOR_LABELS: Readonly<Record<Detector, string>> = {
  sobel: 'Sobel',
  prewitt: 'Prewitt',
  roberts: 'Roberts cross',
  laplacian: 'Laplacian',
  canny: 'Canny',
  scharr: 'Scharr',
  xdog: 'XDoG (ink lines)',
};
