# Builder repeat research

Scope: light research. Pages I cannot open are listed at the end and are not used as sources.

## Wrap rule

A motif that runs off one edge of the tile must re-enter on the opposite edge, in exactly the right position. In Illustrator's manual method, you copy the motif and move the copy one tile width left, or one tile height up. https://patternobserver.com/how-to-create-a-repeat-pattern/

Inference: the full rule is to draw each motif at offsets of -1, 0 and +1 tile in x and in y. That is nine copies, and it covers corners. Draw only the copies that touch the tile.

## Repeat types

- Full drop or block: copies sit side by side with no offset. It can show tracking lines. https://madegooddesigns.com/repeat-patterns-explained/
- Half-drop: every other column shifts down by half the tile height. https://madegooddesigns.com/repeat-patterns-explained/
- Brick or half-brick: every other row shifts sideways. The name "half-brick" needs an offset of exactly half. https://www.printmag.com/design-education/fabric-patterns-deconstructed/
- Mirror: alternate tiles are flipped, so edges always match. Watch for a visible butterfly axis. https://madegooddesigns.com/repeat-patterns-explained/
- Toss: motifs are scattered at varied angles, sizes and spacing. https://madegooddesigns.com/repeat-patterns-explained/
- Diamond and ogee: built on half-drop or half-brick layouts, often with overlap. https://www.printmag.com/design-education/fabric-patterns-deconstructed/
- Hex: the source says all repeats are variants of brick, block or drop. https://www.printmag.com/design-education/fabric-patterns-deconstructed/

Inference: block, half-drop, brick, diamond and ogee are all translations of one rectangular cell. The offset only changes the cell size or the lattice. Toss is a block repeat with many motifs. Mirror is not a translation of one cell, because it flips. It is a translation of a cell twice as big (2x2).

## Illustrator Pattern Options

Tile types: Grid, Brick by Row, Brick by Column, Hex by Column, Hex by Row. https://patternobserver.com/how-to-create-a-repeat-pattern/

Inference: Illustrator exposes "Size Tile to Art" and overlap, but I cannot open Adobe's help page (HTTP 403). I have no opened source on what designers praise or dislike. Do not rely on any claim about those controls from this note.

## SVG output

MDN confirms that `patternUnits="userSpaceOnUse"` makes x, y, width and height absolute. It also has `patternTransform` and x/y offsets. https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/pattern

MDN does not cover seams or overflow. The fixes below come from the model's general knowledge, not from an opened source. Test them in a browser. Inference: use an integer tile size, integer offsets and no rotation of the pattern. Let motifs run past the tile edge and clip them. Test at several zoom levels.

Inference: for a half-drop, make the tile one motif column wide and twice as tall as the cell. Put one copy at the top and one shifted by half the cell height, with wrap copies. A brick repeat is the same idea sideways. I found no opened source for this. The same tile works in `<pattern>` and as a CSS `background-image`.

## Editor performance

A yWorks benchmark tested simple SVG on a desktop Core i7. It gave 60 fps at 1,000 elements, 50 at 2,000, 23 at 5,000 and 10 at 10,000. Older tablets slowed at 1,000. Complex SVG was already not recommended at 1,000. https://www.yworks.com/blog/svg-canvas-webgl

yWorks advises SVG for crisp, interactive graphics and export, with a low three-figure count of visible elements. It says Canvas wins at 2,000 or more simple elements. WebGL suits 10,000 or more. https://www.yworks.com/blog/svg-canvas-webgl

Inference: a few hundred shapes with up to nine wrap copies each is about 2,000 nodes. That is near the slow edge. Draw wrap copies with `<use>` in one group, or cap the count, and test on a weak device.

## Hiding the repeat

Tracking lines are streaks that the eye sees. They run diagonal or vertical. Rigid alignment of motifs causes them. Fix them with a half-drop or varied placement. Vary scale and rotation. Add filler motifs to even out density. Tile several copies and look for lines, holes and clumps. https://madegooddesigns.com/repeat-patterns-explained/

Too few motifs in a tile shows obvious repetition. https://patternobserver.com/how-to-create-a-repeat-pattern/

Not found in any opened source: the 3-size rule (hero, secondary, filler). Treat it as unverified.

## Not opened

Adobe Help and CreativePro returned 403. CSS-Tricks returned 404. Some claims came only from search snippets and are not used here.

## Sources

- https://patternobserver.com/how-to-create-a-repeat-pattern/
- https://madegooddesigns.com/repeat-patterns-explained/
- https://www.printmag.com/design-education/fabric-patterns-deconstructed/
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/pattern
- https://www.yworks.com/blog/svg-canvas-webgl
