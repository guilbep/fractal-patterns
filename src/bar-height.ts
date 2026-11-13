// Sticky offsets: the height of a sticky bar, in whole pixels, as a CSS variable on <html>.
// The pages use it for the toolbar (--bar-h); the Patterns page also for its tab bar (--tabs-h).
import { onBeforeUnmount, onMounted, type Ref } from 'vue';

export function useBarHeight(bar: Ref<HTMLElement | null>, name = '--bar-h'): void {
  const sizes = new ResizeObserver(() => document.documentElement.style.setProperty(name, `${bar.value?.offsetHeight ?? 0}px`));
  onMounted(() => bar.value && sizes.observe(bar.value));
  onBeforeUnmount(() => sizes.disconnect());
}
