// The Builder's first-run coach: when it shows, and the order of its steps.

export const COACH_KEY = 'fp-builder-coach-v1';

export const COACH_STEPS = [
  {
    title: 'The wrap',
    text: 'The dashed square is your tile. Drag a shape over an edge and it comes back on the other side. The faded copies show how it repeats.',
  },
  {
    title: 'The handle',
    text: 'Select a shape, then drag the round handle to turn it and resize it. Hold Shift to turn in 15° steps.',
  },
  {
    title: 'The folds',
    text: 'Each card on the right folds. Its summary line shows what is set inside, so you can close what you do not need.',
  },
] as const;

/** Show the coach to a first-time visitor only: nothing stored, the default design, no design file opened. */
export function shouldShowCoach(stored: string | null, designIsDefault: boolean, openedFromFile: boolean): boolean {
  return stored === null && designIsDefault && !openedFromFile;
}

/** The step after `i`, or null after the last one. */
export function nextStep(i: number): number | null {
  return i + 1 < COACH_STEPS.length ? i + 1 : null;
}
