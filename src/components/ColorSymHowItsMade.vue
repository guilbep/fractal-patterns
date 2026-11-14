<script setup lang="ts">
// "How it's made" for Color symmetry: the idea, the formula with the current values, how colour is chosen.
// Each claim is traced to the code in docs/review/color-symmetry-how-its-made.md.
import { computed } from 'vue';
import { GROUP_OPS, HEX_OPS } from '../patterns/symmetry.ts';

const props = defineProps<{ group: string; waves: number; detail: number; balance: boolean; render: 'bands' | 'wheel' }>();

// |G|: operations per unit cell, as farris.ts averages over them (an unknown group falls back to p1).
const order = computed(() => GROUP_OPS[props.group]?.length ?? HEX_OPS[props.group]?.length ?? 1);
</script>

<template>
  <details class="fold how-made">
    <summary>How it's made</summary>
    <p>
      The color comes from a complex number f at each point of the tile. f is a sum of waves. Each wave is averaged over every move of the
      {{ group }} group. So f has the same value at points that the group maps onto each other.
    </p>
    <math display="block">
      <mrow>
        <mi>f</mi><mo>(</mo><mi>z</mi><mo>)</mo><mo>=</mo>
        <munderover>
          <mo>∑</mo>
          <mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow>
          <mi>W</mi>
        </munderover>
        <msub><mi>a</mi><mi>j</mi></msub>
        <mo>·</mo>
        <mfrac><mn>1</mn><mrow><mo>|</mo><mi>G</mi><mo>|</mo></mrow></mfrac>
        <munder>
          <mo>∑</mo>
          <mrow><mi>g</mi><mo>∈</mo><mi>G</mi></mrow>
        </munder>
        <msup>
          <mi>e</mi>
          <mrow
            ><mn>2</mn><mi>π</mi><mi>i</mi><mspace width="0.1em" /><msub><mi>k</mi><mi>j</mi></msub><mo>·</mo><mi>g</mi><mo>(</mo><mi>z</mi><mo
              >)</mo
            ></mrow
          >
        </msup>
      </mrow>
    </math>
    <math display="block">
      <mrow>
        <mi>W</mi><mo>=</mo><mn>{{ waves }}</mn><mo>,</mo><mspace width="1em" /> <mrow><mo>|</mo><mi>G</mi><mo>|</mo></mrow
        ><mo>=</mo><mn>{{ order }}</mn><mo>,</mo><mspace width="1em" />
        <mo>max</mo><mo>(</mo><mrow><mo>|</mo><msub><mi>k</mi><mn>1</mn></msub><mo>|</mo></mrow><mo>,</mo
        ><mrow><mo>|</mo><msub><mi>k</mi><mn>2</mn></msub><mo>|</mo></mrow><mo>)</mo><mo>≤</mo><mn>{{ detail }}</mn>
      </mrow>
    </math>
    <p class="how-plain">
      f(z) = sum for j = 1 to W of a_j · (1/|G|) · sum over g in G of e^(2πi k_j · g(z)), with W = {{ waves }} waves, |G| = {{ order }}
      moves, and whole-number frequencies k_j = (k1, k2) with |k1| and |k2| at most {{ detail }}.
    </p>
    <p>
      Each frequency k_j is drawn at random from the seed. Each amplitude a_j is a random complex number, made smaller for higher frequencies
      by the factor 1/(1 + |k_j|)^0.6, so fine detail stays faint.
    </p>
    <p v-if="render === 'bands'">
      Color: four levels of the real part of f cut the tile into 5 bands, one color each.
      <template v-if="balance">The levels are set so each band covers about one fifth of the tile (Balance color areas is on).</template>
      <template v-else>The levels are evenly spaced between the lowest and the highest value of that real part (Balance color areas is off).</template>
    </p>
    <p v-else>
      Color: the angle of f picks a place on the palette, read as a circle, between two neighboring colors. The size of f sets light and
      dark: small values are darker, large values are lighter.
    </p>
    <p class="how-source">
      Source: F. Farris, <cite>Creating Symmetry: The Artful Mathematics of Wallpaper Patterns</cite> (Princeton University Press, 2015).
      <a href="https://webpages.scu.edu/ftp/ffarris/AMSNotices.pdf" target="_blank" rel="noopener">Notes by F. Farris (PDF)</a>.
      Method: Frank A. Farris.
    </p>
  </details>
</template>

<style scoped>
.how-plain,
.how-source {
  font-size: 0.85em;
  color: var(--muted);
}
.how-made math {
  overflow-x: auto;
  max-width: 100%;
}
</style>
