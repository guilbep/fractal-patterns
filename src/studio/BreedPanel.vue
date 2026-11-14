<script setup lang="ts">
// Breed: nine children of the current design (or of one or two picked children), grown in a worker one at a time.
// A child whose repeat shows (tracking above the limit) is bred again, up to 4 tries; the best one stays.
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { breed, generation, grow, type Grown } from './breed.ts';
import { TRACKING_LIMIT } from './compose.ts';
import { GENES, geneCount } from './genes.ts';
import { decodeStudio, encodeStudio, type StudioDesign } from './studio-share.ts';

const props = defineProps<{ design: StudioDesign }>();
const emit = defineEmits<{ use: [design: StudioDesign]; clearGenes: [] }>();

// ---- growing: in a worker; where a worker cannot start, on the main thread, one child per task ----
let worker: Worker | null = null;
let workerFailed = false;
let nextId = 0;
const waiting = new Map<number, (g: Grown) => void>();
const onMain = (d: StudioDesign) => new Promise<Grown>((res) => setTimeout(() => res(grow(d))));
function growAsync(d: StudioDesign): Promise<Grown> {
  if (!workerFailed && !worker) {
    try {
      worker = new Worker(new URL('./breed.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<Grown & { id: number }>) => {
        waiting.get(e.data.id)?.(e.data);
        waiting.delete(e.data.id);
      };
      worker.onerror = () => {
        // ponytail: the children in flight are grown again on the main thread.
        workerFailed = true;
        worker?.terminate();
        worker = null;
        for (const [, done] of waiting) done({ uri: '', bg: 'transparent', width: 1, height: 1, score: Infinity });
        waiting.clear();
      };
    } catch {
      workerFailed = true;
    }
  }
  if (!worker) return onMain(d);
  const id = nextId++;
  return new Promise((res) => {
    waiting.set(id, (g) => (g.uri ? res(g) : res(onMain(d))));
    worker!.postMessage({ id, link: encodeStudio(d) });
  });
}
onBeforeUnmount(() => worker?.terminate());

// ---- generations ----
type Slot = { design: StudioDesign; grown: Grown | null };
const gens = shallowRef<Slot[][]>([]);
const current = computed(() => gens.value.at(-1) ?? []);
const picked = ref<number[]>([]);
const difference = ref(0.4);
const status = ref('');
const differenceText = computed(() => (difference.value < 0.34 ? 'similar' : difference.value < 0.67 ? 'some change' : 'different'));
let token = 0;

async function newGeneration(parents: StudioDesign[]): Promise<void> {
  const my = ++token;
  const diff = difference.value;
  const slots = reactive(generation(parents, diff, Math.random).map((design): Slot => ({ design, grown: null })));
  gens.value = [...gens.value, slots];
  picked.value = [];
  const n = gens.value.length;
  for (let i = 0; i < slots.length; i++) {
    status.value = `Growing generation ${n}: ${i} of ${slots.length} ready.`;
    let best: Slot | null = null;
    for (let t = 0; t < 4; t++) {
      const d = t === 0 ? slots[i]!.design : breed(parents, diff, Math.random);
      const g = await growAsync(d);
      if (my !== token) return;
      if (!best || g.score < best.grown!.score) best = { design: d, grown: g };
      if (g.score <= TRACKING_LIMIT) break;
    }
    slots[i] = best!;
  }
  status.value = `Generation ${n} ready. Pick one or two, then breed again or use one.`;
}

function toggle(i: number): void {
  const p = picked.value;
  picked.value = p.includes(i) ? p.filter((x) => x !== i) : [...p, i].slice(-2);
}
const parents = () => (picked.value.length > 0 ? picked.value.map((i) => current.value[i]!.design) : [props.design]);
const breedNext = () => void newGeneration(parents());
function useOne(): void {
  const slot = current.value[picked.value[0]!];
  if (!slot) return;
  emit('use', decodeStudio(encodeStudio(slot.design)));
  status.value = `Child ${picked.value[0]! + 1} is now the wallpaper.`;
}
function undoGeneration(): void {
  if (gens.value.length < 2) return;
  token++;
  gens.value = gens.value.slice(0, -1);
  picked.value = [];
  status.value = `Back to generation ${gens.value.length}.`;
}
onMounted(() => void newGeneration([props.design]));

const thumb = (g: Grown) => {
  const k = 52 / Math.max(g.width, g.height); // two tiles across a thumbnail of about 104 px
  return { backgroundColor: g.bg, backgroundImage: `url("${g.uri}")`, backgroundSize: `${g.width * k}px ${g.height * k}px` };
};
const genes = computed(() => geneCount(props.design.genes));
</script>

<template>
  <div class="breed">
    <p class="hint-text">Nine children of your wallpaper. Pick one or two you like, then breed the next generation.</p>
    <div class="breed-grid" role="group" :aria-label="`Children, generation ${gens.length}`">
      <button
        v-for="(slot, i) in current"
        :key="`${gens.length}-${i}`"
        type="button"
        class="breed-child"
        :aria-pressed="picked.includes(i)"
        :aria-label="slot.grown ? `Child ${i + 1}` : `Child ${i + 1}, growing`"
        @click="toggle(i)"
      >
        <span class="breed-thumb" :style="slot.grown ? thumb(slot.grown) : undefined" aria-hidden="true"></span>
        <span class="breed-mark" aria-hidden="true">{{ picked.includes(i) ? '✓' : '' }}</span>
      </button>
    </div>
    <div class="field">
      <label for="breed-difference">More similar ↔ More different <output for="breed-difference">{{ differenceText }}</output></label>
      <input id="breed-difference" v-model.number="difference" type="range" min="0" max="1" step="0.05">
    </div>
    <div class="breed-actions">
      <button type="button" class="btn primary" @click="breedNext">Breed next generation</button>
      <button type="button" class="btn" :disabled="picked.length !== 1" @click="useOne">Use the picked one</button>
      <button type="button" class="btn" :disabled="gens.length < 2" @click="undoGeneration">Undo generation</button>
    </div>
    <p class="hint-text breed-genes">
      Genes set on this wallpaper: {{ genes }} of {{ GENES.length }}.
      <button v-if="genes > 0" type="button" class="link-btn" @click="emit('clearGenes')">Clear genes</button>
    </p>
    <p class="visually-hidden" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
.breed {
  display: grid;
  gap: var(--s3);
}
.breed .hint-text {
  margin: 0;
}
.breed-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s2);
  max-width: 24rem;
}
.breed-child {
  position: relative;
  aspect-ratio: 1;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--sunk);
  cursor: pointer;
  overflow: hidden;
}
.breed-child[aria-pressed='true'] {
  outline: 3px solid var(--accent);
  outline-offset: 1px;
}
.breed-child:focus-visible {
  outline: 3px solid var(--ink);
  outline-offset: 2px;
}
.breed-thumb {
  position: absolute;
  inset: 0;
}
.breed-mark {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
  font-size: 0.8rem;
}
.breed-mark:empty {
  display: none;
}
.breed-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}
</style>
