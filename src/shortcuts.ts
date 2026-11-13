// Single-key shortcuts for both pages: R shuffles, F shows the preview full screen.
// WCAG 2.1.4: a single-key shortcut needs an off switch. One stored choice serves both pages.
const STORE = 'fp-shortcut';

export function readShortcut(): boolean {
  try {
    return localStorage.getItem(STORE) !== '0';
  } catch {
    return true;
  }
}

export function writeShortcut(on: boolean): void {
  try {
    localStorage.setItem(STORE, on ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

export type Shortcut = 'shuffle' | 'fullscreen';
interface Keys {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

// The action of a key press, or null. `typing`: the focus is in a form field, where letters are text.
export function shortcutFor(e: Keys, typing: boolean): Shortcut | null {
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key.toLowerCase();
  return k === 'r' ? 'shuffle' : k === 'f' ? 'fullscreen' : null;
}

export const isTyping = (e: Event): boolean =>
  !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');

// Esc leaves full screen by itself. Where the browser has no element full screen (iPhone), nothing happens.
export function toggleFullscreen(el: Element | null): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el?.requestFullscreen?.().catch(() => {});
}
