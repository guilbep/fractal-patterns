# Review: "How it's made" for Color symmetry

Component: `src/components/ColorSymHowItsMade.vue`. Props: `group`, `waves`, `detail`, `balance`, `render`.
Each claim below names the code it comes from. Line numbers are on branch `cs-how` at the time of writing.

## Entry text

> The colour comes from a complex number f at each point of the tile. f is a sum of waves. Each wave is averaged over every move of the {group} group. So f has the same value at points that the group maps onto each other.
>
> f(z) = Σ_{j=1}^{W} a_j · (1/|G|) Σ_{g∈G} e^{2πi k_j·g(z)}
> W = {waves}, |G| = {order}, max(|k1|, |k2|) ≤ {detail}
>
> (plain-text line, small and muted) f(z) = sum for j = 1 to W of a_j · (1/|G|) · sum over g in G of e^(2πi k_j · g(z)), with W = {waves} waves, |G| = {order} moves, and whole-number frequencies k_j = (k1, k2) with |k1| and |k2| at most {detail}.
>
> Each frequency k_j is drawn at random from the seed. Each amplitude a_j is a random complex number, made smaller for higher frequencies by the factor 1/(1 + |k_j|)^0.6, so fine detail stays faint.
>
> Bands, balance on: Colour: four levels of the real part of f cut the tile into 5 bands, one colour each. The levels are set so each band covers about one fifth of the tile.
> Bands, balance off: ... The levels are evenly spaced between the lowest and the highest value of that real part.
> Wheel: Colour: the angle of f picks a place on the palette, read as a circle, between two neighbouring colours. The size of f sets light and dark: small values are darker, large values are lighter.
>
> Source: F. Farris, _Creating Symmetry: The Artful Mathematics of Wallpaper Patterns_ (Princeton University Press, 2015). Notes by F. Farris (PDF), https://webpages.scu.edu/ftp/ffarris/AMSNotices.pdf. Method: Frank A. Farris.

## Claims and their source

| Claim                                                                                                                                             | Code                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| f is a complex field, sum of plane waves `exp(2πi k·g(c))` averaged over the group                                                                | `src/patterns/farris.ts` lines 1-5 (header), 101-111 (loop over ops), 123-134 (`evalWaves`)                                              |
| 1/\|G\|: each amplitude is divided by the number of ops                                                                                           | `src/patterns/farris.ts` lines 99-100 (`/ ops.length`)                                                                                   |
| \|G\| = count of `GROUP_OPS[group]` (square groups) or `HEX_OPS[group]` (hex groups)                                                              | `src/patterns/farris.ts` lines 35-38, 54-55, 71-77. The component reads the same tables from `src/patterns/symmetry.ts` lines 12 and 294 |
| Unknown group falls back to p1 (\|G\| = 1)                                                                                                        | `src/patterns/farris.ts` line 83                                                                                                         |
| W = Waves setting, clamped to 2..8                                                                                                                | `src/patterns/farris.ts` lines 85, 90, 112. `src/color-sym.ts` lines 8-9                                                                 |
| Frequencies are whole numbers, each component in -Detail..Detail, not (0, 0)                                                                      | `src/patterns/farris.ts` lines 86, 91-96. `src/color-sym.ts` lines 10-11                                                                 |
| Frequencies and amplitudes come from the seed                                                                                                     | `src/patterns/farris.ts` line 87 (`mulberry32(r.seed)`)                                                                                  |
| Amplitude: random complex number (Rayleigh size, uniform angle, so a complex Gaussian), divided by (1 + \|k\|)^0.6                                | `src/patterns/farris.ts` lines 97-98                                                                                                     |
| g(z) = A z + t, in lattice coordinates. Square ops: probed from `GROUP_OPS` as affine maps mod 1. Hex ops: matrices about a lattice point, t = 0. | `src/patterns/farris.ts` lines 4, 34-51, 53-68                                                                                           |
| Bands: 4 levels of the real part of f, 5 colour bands                                                                                             | `src/patterns/farris-bands.ts` lines 1-2, 18, 39-47                                                                                      |
| Balance on: levels at the 1/5, 2/5, 3/5, 4/5 quantiles, so each band covers about a fifth                                                         | `src/patterns/farris-bands.ts` line 18                                                                                                   |
| Balance off: levels evenly spaced between min and max                                                                                             | `src/patterns/farris-bands.ts` lines 16-18                                                                                               |
| Wheel: the angle of f picks a palette position, cyclic, blending the two neighbours                                                               | `src/patterns/farris-wheel.ts` lines 25-32                                                                                               |
| Wheel: \|f\| sets the shade, 0.35 + 0.9 \|f\| / (95th percentile of \|f\|), clamped to 0..1.15                                                    | `src/patterns/farris-wheel.ts` lines 19-22, 30                                                                                           |

Group orders (\|G\|) read from the code. They match the expected table.

| Group | p1  | p2  | pm  | pg  | cm  | pmm | pmg | pgg | cmm | p4  | p4m | p4g | p3  | p3m1 | p31m | p6  | p6m |
| ----- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- | ---- | --- | --- |
| \|G\| | 1   | 2   | 2   | 2   | 4   | 4   | 4   | 4   | 8   | 4   | 8   | 8   | 3   | 6    | 6    | 6   | 12  |

## Where the code differs from Farris's textbook method

- The frequency range is a square box, max(|k1|, |k2|) ≤ Detail, not a disc |k| ≤ Detail. The entry says so.
- The waves and amplitudes are random (seeded). Farris picks coefficients by hand for each design.
- The damping 1/(1 + |k|)^0.6 is this code's choice. Not verified as part of Farris's method.
- W can be larger than the Waves setting: if all drawn waves cancel out (total amplitude below 1e-6), the code draws more, up to 64 (`farris.ts` lines 90, 112-115). The entry shows W = Waves. This edge case is not mentioned on the page.
- cm and cmm use a square cell with a centring move (shift by 1/2, 1/2) in the op list. Farris uses a rhombic lattice for these groups. The result has the same symmetry, but |G| counts the centring move, so cm shows 4 and cmm shows 8.
- Colour: Farris colours by domain colouring with a photo or a colour wheel. This code uses either isobands of the real part of f, or a palette wheel with a 95th-percentile shade. The wheel is close to domain colouring. The bands are not in the textbook (not verified).
- Waves with the same frequency after the group moves are merged into one wave (`farris.ts` lines 106-110). This changes speed, not the result.
