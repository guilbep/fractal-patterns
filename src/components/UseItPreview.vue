<script setup lang="ts">
// The "Use it" preview: the tile on the device it is made for, drawn with CSS and inline SVG only.
import { computed } from 'vue';
import { svgToDataUri } from '@/css.ts';
import { DESTINATIONS, type Destination, type Output } from '@/use-it.ts';

const props = defineProps<{
  svg: string;
  tileWidth: number;
  tileHeight: number;
  background: string | null;
  destination: Destination['id'];
  /** Output pixels; null for CSS and SVG outputs. */
  width: number | null;
  height: number | null;
  /** Hero only: the pattern fills a band at the top of the page instead of the whole page. */
  hero?: boolean;
  clockFade: boolean;
  /** Shown under the device: the chosen preset and its file type. */
  presetLabel: string;
  output: Output;
}>();

const label = computed(() => DESTINATIONS.find((d) => d.id === props.destination)?.label ?? '');
const detail = computed(() =>
  [props.width && props.height ? `${props.width} × ${props.height} px` : '', props.output.toUpperCase()].filter(Boolean).join(' · '),
);
// The clock is dark ink on a light background, white on a dark one (a #rgb or #rrggbb background; dark ink otherwise).
const clockInk = computed(() => {
  const hex = props.background?.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return '#1b1d33';
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! < 128 ? '#ffffff' : '#1b1d33';
});

// When there is no pixel size (CSS, SVG), each device has a usual size the tile is seen at.
const FALLBACK: Record<Destination['id'], [number, number]> = {
  phone: [1206, 2622],
  desktop: [3024, 1964],
  web: [1440, 900],
  call: [1920, 1080],
  fabric: [1181, 1181],
  paper: [2480, 3508],
  game: [1024, 1024],
  slides: [1920, 1080],
};
const size = computed((): [number, number] => (props.width && props.height ? [props.width, props.height] : FALLBACK[props.destination]));
const ratio = computed(() => size.value[0] / size.value[1]);

// background-size in % of the drawn area: the tile takes the same share of the frame as of the output.
// Fabric: the shirt front is about 2.5 printed tiles wide (a 20 cm tile on a 50 cm shirt).
const across = computed(() => (props.destination === 'fabric' ? 2.5 : 1));
const pattern = computed(() => ({
  backgroundColor: props.background ?? 'transparent',
  backgroundImage: `url("${svgToDataUri(props.svg)}")`,
  backgroundSize: `${((props.tileWidth / size.value[0]) * 100) / across.value}% auto`,
}));
const fade = computed(() => `linear-gradient(to bottom, ${props.background ?? 'rgb(0 0 0 / 0.55)'} 0%, transparent 32%)`);

const SHIRT =
  'M30 4 L12 12 L2 34 L16 40 L22 30 L22 96 L78 96 L78 30 L84 40 L98 34 L88 12 L70 4 C66 12 58 16 50 16 C42 16 34 12 30 4 Z';
const shirtMask = `url("${svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${SHIRT}"/></svg>`)}")`;
</script>

<template>
  <figure class="use-it-preview" :data-device="destination">
    <div class="uip-stage" aria-hidden="true">
      <div v-if="destination === 'phone'" class="uip-phone" :style="{ '--ar': ratio }">
        <div class="uip-screen" :style="pattern">
          <div v-if="clockFade" class="uip-fade" :style="{ backgroundImage: fade }"></div>
          <div class="uip-clock" :style="{ color: clockInk }"><span class="uip-date">Friday 13 November</span>9:41</div>
        </div>
      </div>

      <div v-else-if="destination === 'desktop'" class="uip-laptop" :style="{ '--ar': ratio }">
        <div class="uip-lid"><div class="uip-screen" :style="pattern"></div></div>
        <div class="uip-base"></div>
      </div>

      <div v-else-if="destination === 'web'" class="uip-browser" :style="{ '--ar': ratio }">
        <div class="uip-bar"><i></i><i></i><i></i><span class="uip-url"></span></div>
        <div class="uip-page" :class="{ 'uip-hero': hero }">
          <div class="uip-screen" :style="pattern">
            <div class="uip-text"><b>Your site</b><span></span><span></span></div>
          </div>
        </div>
      </div>

      <div v-else-if="destination === 'call'" class="uip-call" :style="{ '--ar': ratio }">
        <div class="uip-screen" :style="pattern">
          <svg class="uip-person" viewBox="0 0 100 60" preserveAspectRatio="xMidYMax meet">
            <circle cx="50" cy="26" r="13" />
            <path d="M22 60 C22 44 34 38 50 38 C66 38 78 44 78 60 Z" />
          </svg>
          <span class="uip-name">You</span>
        </div>
      </div>

      <div v-else-if="destination === 'fabric'" class="uip-shirt">
        <div class="uip-screen" :style="{ ...pattern, maskImage: shirtMask, WebkitMaskImage: shirtMask }"></div>
        <svg class="uip-outline" viewBox="0 0 100 100"><path :d="SHIRT" /></svg>
      </div>

      <div v-else-if="destination === 'game'" class="uip-game">
        <div v-for="n in 9" :key="n" class="uip-screen" :style="pattern"></div>
      </div>

      <div v-else-if="destination === 'paper'" class="uip-paper" :style="{ '--ar': ratio }">
        <div class="uip-screen" :style="pattern"></div>
      </div>

      <div v-else class="uip-slide" :style="{ '--ar': ratio }">
        <div class="uip-screen" :style="pattern">
          <div class="uip-title"><b>Quarterly review</b><span></span></div>
        </div>
      </div>
    </div>
    <figcaption class="uip-caption">
      <span class="visually-hidden">Preview: {{ label }}, </span>
      <b>{{ presetLabel }}</b>
      <span class="uip-detail">{{ detail }}</span>
    </figcaption>
  </figure>
</template>

<style>
.uip-caption {
  display: grid;
  justify-items: center;
  gap: 2px;
  margin-top: var(--s2);
  text-align: center;
}
.uip-detail {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.9375rem;
}
.use-it-preview {
  margin: 0;
  min-width: 0;
}
.uip-stage {
  container-type: size;
  display: grid;
  place-items: center;
  height: 34rem;
  padding: var(--s4);
  background: var(--sunk);
  border-radius: var(--radius-card);
}
@media (max-width: 47.99rem) {
  .uip-stage {
    height: 15rem;
  }
}
.uip-screen {
  position: relative;
  overflow: hidden;
  background-repeat: repeat;
}
.uip-phone,
.uip-call,
.uip-paper,
.uip-slide,
.uip-browser {
  width: min(100cqw, calc(100cqh * var(--ar)));
  aspect-ratio: var(--ar);
}
/* Phone: a rounded body, the clock over the wallpaper. */
.uip-phone {
  box-sizing: border-box;
  padding: 3%;
  background: #17181c;
  border-radius: 14% / 6.5%;
  box-shadow: 0 0 0 1px var(--line);
}
.uip-phone .uip-screen {
  height: 100%;
  border-radius: 12% / 5.6%;
}
.uip-fade {
  position: absolute;
  inset: 0;
}
.uip-clock {
  position: absolute;
  inset: 9% 0 auto;
  display: grid;
  justify-items: center;
  font: 800 clamp(1.5rem, 11cqh, 5rem) / 1 var(--font);
  letter-spacing: -0.02em;
}
.uip-date {
  font-size: 0.26em;
  font-weight: 600;
  letter-spacing: 0;
  margin-bottom: 0.2em;
}
/* Laptop: the lid with a screen, a flat base under it. */
.uip-laptop {
  display: grid;
  justify-items: center;
  width: min(100cqw, calc(88cqh * var(--ar)));
}
.uip-lid {
  box-sizing: border-box;
  width: 84%;
  padding: 2.5% 2.5% 3%;
  background: #1a1a1a;
  border-radius: 10px 10px 0 0;
}
.uip-lid .uip-screen {
  aspect-ratio: var(--ar);
}
.uip-base {
  width: 100%;
  height: 0.75rem;
  background: linear-gradient(#c9cbd1, #8e9097);
  border-radius: 0 0 12px 12px / 0 0 8px 8px;
}
/* Website: a browser window, a text box on the pattern. */
.uip-browser {
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.uip-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  background: var(--sunk);
  border-bottom: 1px solid var(--hairline);
}
.uip-bar i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line);
}
.uip-url {
  flex: 1;
  height: 10px;
  margin-left: 8px;
  background: var(--surface);
  border-radius: 999px;
}
.uip-page {
  display: grid;
  grid-template-columns: 100%;
  min-height: 0;
}
.uip-page.uip-hero {
  align-content: start;
  background: repeating-linear-gradient(to bottom, transparent 0 14px, var(--hairline) 14px 20px) 50% 88% / 70% 22% no-repeat;
}
.uip-page.uip-hero .uip-screen {
  aspect-ratio: 5 / 2;
}
.uip-page .uip-screen {
  display: grid;
  place-items: center;
}
.uip-text {
  display: grid;
  gap: 6px;
  width: 50%;
  padding: 6% 7%;
  color: var(--ink);
  background: var(--surface);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
}
.uip-text span,
.uip-title span {
  height: 6px;
  background: var(--hairline);
  border-radius: 3px;
}
.uip-text span:last-child {
  width: 70%;
}
/* Video call: a 16:9 picture with a head-and-shoulders silhouette. */
.uip-call {
  overflow: hidden;
  border: 6px solid #202124;
  border-radius: 10px;
}
.uip-call .uip-screen,
.uip-paper .uip-screen,
.uip-slide .uip-screen {
  height: 100%;
}
.uip-person {
  position: absolute;
  bottom: 0;
  left: 20%;
  width: 60%;
  height: 80%;
  fill: #3c4043;
}
.uip-name {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 1px 6px;
  color: #fff;
  font-size: 0.75rem;
  background: rgb(0 0 0 / 0.6);
  border-radius: 4px;
}
/* T-shirt: the pattern cut to a shirt shape, with an outline on top. */
.uip-shirt {
  position: relative;
  width: min(100cqw, 100cqh);
  aspect-ratio: 1;
}
.uip-shirt .uip-screen {
  position: absolute;
  inset: 0;
  mask-size: 100% 100%;
  -webkit-mask-size: 100% 100%;
}
.uip-outline {
  position: absolute;
  inset: 0;
  fill: none;
  stroke: var(--ink);
  stroke-width: 1;
  stroke-linejoin: round;
}
/* Game: 3 × 3 tiles with thin gaps, to show the edges match. */
.uip-game {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  width: min(100cqw, 100cqh);
  aspect-ratio: 1;
}
.uip-game .uip-screen {
  aspect-ratio: 1;
}
/* Paper: a sheet with a soft shadow. */
.uip-paper {
  width: min(100cqw, calc(100cqh * var(--ar)));
  background: #fff;
  box-shadow: 0 3px 12px rgb(0 0 0 / 0.25);
}
/* Slide: a title bar on the pattern. */
.uip-slide {
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: 0 3px 12px rgb(0 0 0 / 0.2);
}
.uip-title {
  display: grid;
  gap: 6px;
  padding: 5% 7%;
  color: var(--ink);
  font-size: clamp(0.75rem, 6cqh, 1.5rem);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
}
.uip-title span {
  width: 40%;
}
</style>
