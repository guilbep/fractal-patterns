# Palettes: research notes

Date: 2026-11-13. Purpose: build palettes on findings about color preference, not on classic harmony schemes.

## Sources

Both papers were opened and read.

- Schloss and Palmer (2011), "Aesthetic response to color combinations: preference, harmony, and similarity", Attention, Perception and Psychophysics 73, 551-571: <https://pmc.ncbi.nlm.nih.gov/articles/PMC3037488/>
- Palmer and Schloss (2010), "An ecological valence theory of human color preference", PNAS 107, 8877-8882: <https://pmc.ncbi.nlm.nih.gov/articles/PMC2889342/>

## Findings

From Schloss and Palmer (2011):

- More similar hues give a pair more preference and more harmony. A larger hue difference gives steadily less of both.
- Complementary pairs are not preferred.
- Preference rises with lightness contrast.
- Cooler pairs are preferred and are judged more harmonious.
- A warm figure on a cool ground is preferred.
- Saturated figures are liked. Saturated grounds are disliked.
- Harmonious pairs have lower total saturation.

From Palmer and Schloss (2010):

- Blue and cyan are the most liked hues.
- Dark yellow (olive) and dark orange (brown) are the most disliked. Chartreuse is a low point.
- Dark red and dark green are liked more than other reds and greens.
- Saturated colors are liked more than light or muted colors.

## Rules in the code

The numbers are our inference from the findings. They are not values from the papers. The code is `src/palettes.ts`.

| Rule | Value |
|---|---|
| Stroke and soft color | Same hue as the base, or within 20 degrees |
| Accent, "near" | Base hue plus 35 degrees |
| Accent, "warm" | Hue 40, for a cool base (180 to 280 degrees) |
| Paper and soft | Low chroma: paper at most 0.02, soft at most 0.05 |
| Accent chroma | The largest value inside sRGB at its lightness, at most 0.19 |
| Stroke chroma | 60 percent of that |
| Hues 60 to 115 | Moved to 50 or to 130, so that no olive or brown appears |
| Dark palettes | Paper lightness 0.23, ink lightness 0.94 |

The curated set has 16 light palettes and 8 dark palettes. 14 of the 24 have a cool base. A random palette draws a base hue in 180 to 280 with probability 0.6.

## Contrast limits

- A light palette keeps the text at 7:1 or more on its own ground.
- A dark palette keeps the text at 4.5:1 or more. Light text on a dark ground cannot reach 7:1 over the strokes at the default opacity.

## Ideas for later

- A grid that shows each color pair with its contrast, as accessiblepalette.com and huetone.ardov.me do.
- A score for a palette from simple features (hue spread, lightness contrast), in the spirit of O'Donovan, Agarwala and Hertzmann (2011). Their data and weights have a non-commercial license. Do not ship them.
