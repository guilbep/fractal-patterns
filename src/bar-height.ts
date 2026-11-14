// Sticky offsets: the height of a sticky bar, in whole pixels, as a CSS variable on <html>.
// The pages use it for the toolbar (--bar-h); the Patterns page also for its tab bar (--tabs-h).
import { onBeforeUnmount, onMounted, type Ref } from 'vue';

export function useBarHeight(bar: Ref<HTMLElement | null>, name = '--bar-h'): void {
  // The size from the entry, not offsetHeight: reading layout here, after another bar's observer set a variable on
  // <html>, forced a full style and layout pass at start.
  const sizes = new ResizeObserver(([e]) =>
    document.documentElement.style.setProperty(name, `${Math.round(e?.borderBoxSize[0]?.blockSize ?? 0)}px`),
  );
  onMounted(() => bar.value && sizes.observe(bar.value));
  onBeforeUnmount(() => sizes.disconnect());
}
