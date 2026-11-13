# Wallpaper repeats: research notes

Date: 2026-11-13. Purpose: find techniques that make the Wallpaper Studio repeat less visibly.

## Limits of this research

The evidence is thin. A search agent opened eight pages and read each one as a summary, not as raw text. It opened no museum page on repeat construction. Every number in this file is an inference, not a sourced value.

The studio uses techniques and structures only. It copies no design.

## Pages that the agent opened

- William Morris, "Some Hints on Pattern Designing" (1881): <https://www.marxists.org/archive/morris/works/1881/hints.htm>
- Pattern Observer, layouts: <https://patternobserver.com/?p=103257>
- Made Good Designs, pattern guide: <https://madegooddesigns.com/pattern-design-guide/>
- Wikipedia, William Morris wallpaper designs: <https://en.wikipedia.org/wiki/William_Morris_wallpaper_designs>
- V&A, William Morris and wallpaper design: <https://www.vam.ac.uk/articles/william-morris-and-wallpaper-design>
- Artlandia, sateen repeat: <https://artlandia.com/wonderland/glossary/SateenRepeat.html>
- Lewis F. Day, "Pattern Design" (1903), an excerpt: <https://archive.org/details/patterndesignboo00dayl>
- William Morris Gallery, Trellis: <https://www.wmgallery.org.uk/object/design-for-trellis-wallpaper/>

## What the sources support

- Morris: a viewer must not be able to count the repeats.
- Morris: lines that the eye follows are the main defect. Vertical lines are the worst, diagonal lines are bad, and horizontal lines matter less.
- Day: plan the lines on purpose. A design with no planned lines produces stripes by accident.
- Working method: tile several copies, step back, and look for holes, clumps, and lines.
- Fixes: use a half-drop, change the placement, and fill gaps with buds, dots, or leaves.
- Direction: do not point too many motifs the same way.
- Depth: the Morris papers of the 1870s weave a foreground and a background together.
- Spot layouts (sateen): motifs sit on a grid with exactly one motif per row and per column.

## Repeat structures

| Structure | Geometry | Effect on the repeat |
|---|---|---|
| Half-drop | Each column moves down by half the tile height | The best supported fix for visible lines |
| Brick | Each row moves sideways by half the tile width | Same idea, on rows |
| Mirror (turnover) | The picture is reversed along a vertical line | The seam can show as an axis |
| Net (diaper, ogee, trellis) | Motifs sit on the crossings of diamond lines | A strong structure, so the fill must vary |
| Branch | A stem runs along a diagonal line | Hides the grid, but makes a diagonal |
| Dislocated net | Alternate boughs slip down | Loosens a net |
| Spot (sateen) | One motif per row and per column | Very hard to see |
| Toss | Motifs at free angles and distances | The directions must vary, or lines appear |

Scale and counterchange layouts: not verified.

## What we decided to build

In this order:

1. A line and hole test in the composer. The code tiles the composition three by three and measures strips and empty discs. If a strip is too dense or a hole is too large, the code composes again.
2. A ground layer of small foliage behind the plants, in a fainter tint.
3. Spot placement for the small filler motifs, with different angles.
4. Two or three sizes for each motif family.

Built: item 1, the test `src/studio/tracking.ts`. Over 3 themes, 4 repeats and seeds 1 to 30, a search over 6 seeds lowers the share of tiles over the limit from 25.3% to 10.3%; the search runs when the studio's Balance automatically checkbox is on (the default for a fresh page; links made before the `ba` key keep it off).

Already built: a "Large tile" option. One tile is twice as wide and high and holds about 3.5 times the plants.

## Rights

- Morris died in 1896 and Day in 1910. Their writing is in the public domain. These dates come from general knowledge. No opened page confirmed them.
- The V&A page and the Artlandia page reserve their rights. Do not copy their text or images.
- The Wikipedia text has the CC BY-SA 4.0 license.
- Voysey was not researched. Make sure of his dates before you cite him.
