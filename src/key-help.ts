// The keyboard help panel. Plain DOM with no Vue import: SiteHeader loads it on first open, and a lazy chunk
// that imports Vue made the bundler split the shared start chunk (+1.6 kB gzip per page).
type Page = 'patterns' | 'studio' | 'builder';
interface Options {
  page: Page;
  opener: HTMLElement;
  shortcut?: { get(): boolean; set(v: boolean): void } | undefined;
  onClose?: () => void;
}

const COMMON: [string, string][] = [
  ['R', 'Shuffle: a new seed'],
  ['F', 'Full screen'],
  ['Ctrl/Cmd + Z', 'Undo'],
  ['Ctrl/Cmd + Shift + Z', 'Redo'],
];
const KEYS: Record<Page, [string, string][]> = {
  patterns: [...COMMON, ['Arrow keys', 'Move between the tabs and between the pattern kinds']],
  studio: COMMON,
  builder: [
    ['N / P', 'Select the next / previous shape'],
    ['Arrow keys', 'Move the selected shapes'],
    ['Shift + arrow keys', 'Move them 10 steps'],
    ['[ / ]', 'Turn by 15°'],
    ['- / +', 'Make smaller / larger'],
    ['F', 'Flip'],
    ['D', 'Duplicate'],
    ['Delete', 'Remove'],
    ['PageUp / PageDown', 'Bring forward / send backward'],
    ['Ctrl/Cmd + A', 'Select all shapes'],
    ['F (outside the tile editor)', 'Full screen: the pattern, tiled'],
    ['Esc', 'Clear the selection'],
    ['Ctrl/Cmd + Z', 'Undo'],
    ['Ctrl/Cmd + Shift + Z', 'Redo'],
    ['Shift-click', 'Add a shape to the selection'],
    ['Drag on empty space', 'Select an area'],
    ['Drag the round handle', 'Turn and resize'],
    ['Alt + drag', 'Drag freely when Snap is on'],
  ],
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

let dlg: HTMLDialogElement | null = null;
let current: Options | null = null;
let sw: HTMLButtonElement | null = null;

function build(o: Options): HTMLDialogElement {
  const d = el('dialog', { class: 'key-help', 'aria-labelledby': 'key-help-h' }, el('h2', { id: 'key-help-h' }, 'Keyboard shortcuts'));
  if (o.page === 'builder') d.append(el('p', { class: 'muted' }, 'The single keys act only while the tile editor has focus.'));
  const body = el('tbody');
  for (const [k, a] of KEYS[o.page]) body.append(el('tr', {}, el('th', { scope: 'row' }, el('kbd', {}, k)), el('td', {}, a)));
  d.append(el('table', {}, body));
  if (o.shortcut) {
    // Same markup and classes as UiSwitch.vue, so controls.css styles it.
    const label = `Keyboard shortcuts: R shuffles, F shows the ${o.page === 'studio' ? 'wallpaper' : 'pattern'} full screen`;
    sw = el(
      'button',
      { id: 'key-help-sw', type: 'button', role: 'switch', class: 'ui-switch-track', 'aria-labelledby': 'key-help-sw-label' },
      el('span', { class: 'ui-switch-thumb', 'aria-hidden': 'true' }),
    );
    sw.addEventListener('click', () => {
      const s = current?.shortcut;
      if (!s) return;
      const on = !s.get();
      s.set(on);
      sw!.setAttribute('aria-checked', String(on));
    });
    d.append(
      el('div', { class: 'ui-switch' }, sw, el('label', { id: 'key-help-sw-label', for: 'key-help-sw', class: 'ui-switch-label' }, label)),
    );
  }
  const close = el('button', { type: 'button', class: 'btn secondary' }, 'Close');
  close.addEventListener('click', () => d.close());
  d.append(el('p', { class: 'key-help-close' }, close));
  d.addEventListener('close', () => {
    current?.opener.focus();
    current?.onClose?.();
  });
  document.body.append(d);
  return d;
}

export function openKeyHelp(o: Options): void {
  current = o;
  dlg ??= build(o);
  sw?.setAttribute('aria-checked', String(!!o.shortcut?.get()));
  if (!dlg.open) dlg.showModal();
}
