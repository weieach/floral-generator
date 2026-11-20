# Floral Generator

A web-based 2D flower generator built from geometry and creative coding. Every flower sits on a
grid of concentric rings (core, middle, petal), cut into a number of identical, mirrored slices,
so the pattern repeats exactly from slice to slice.

Live: https://floral-generator.vercel.app

## Visual directions

Each direction is a tab in the top nav, numbered from 0:

0. **Giorgia Lupi (trial)** — flat printed colour and fine-line hatching on a paper tile
   ([flora.js](flora.js), which also holds the shared geometry).
1. **Translucent** — scanned-flower petals with soft washes, gradual dark tips and a blurred
   ink centre ([butterfly.js](butterfly.js)).
2. **Playful** — flat cut-paper flowers with hand-cut edges ([paper.js](paper.js)).
3. **Painterly** — brushworked, blotched petals with leaves on black felt ([paint.js](paint.js)).

The first tab, **All style overview**, shows every direction in a 2×2 grid. Randomize gives all
four a new design (one shared seed, each at its own petal count); click a card to randomize just
that one. Back undoes the last change. The ↗ button on a card opens it in its own tab.

The last tab, **Garden randomization**, shows 20 Translucent flowers at once, drawn by the same
generator with its odds re-weighted toward a hand-picked set of favourites (the `GARDEN` block in
[butterfly.js](butterfly.js)). Each flower picks its own petal count. Randomize replaces all 20,
clicking a flower reshuffles just it, Back undoes, and the ↓ button on a flower saves it as a PNG.
The 20 seeds are kept in the URL. The **Full colour range** switch (`C`) makes every palette and
two-tone wash equally likely instead of favouring the favourites' ones; flipping it recolours the
same 20 flowers without changing their shapes. On top of the re-weighting it follows these rules:

- No fan-shaped petals, and only smooth or notched petal edges.
- One or two layers, even odds.
- **One layer:** 5–8 petals, or 5–6 if they are spatulate (spatulate petals are also kept narrow, so
  they don't close into a single disc).
- **Two layers:** 5–7 petals per layer; no spatulate petals or notched edges on either layer, no lanceolate
  petals on the back layer, nor orbicular ones behind an orbicular front; tip dots on one layer at most, and none at all next to a scorched
  layer. The back layer's tip is only ever scorched or plain, sits in a lower category than the
  front's (ink-dipped > deep colour > scorched > plain; both plain is fine), and its colour is
  never darker than the front tip's. When both tips are plain, the two layers share the front's hue, and
  whenever both layers' washes are the same colour the front one (never the back) is made subtly
  darker.
- Lanceolate petals never get the three-dot tip, on a two-layer flower get no tip dots at all, and on a
  one-layer flower only rarely get their single dot.
- Ovate petals get one tip dot at most.
- With an even petal count, tip dots have a 50% chance of showing on every other petal only.

Garden seeds only reproduce in the Garden tab; the same seed in Translucent gives another flower.

The Garden's rules and their status are tracked in [docs/garden-rules.md](docs/garden-rules.md)
(check them with `node tools/check-garden-rules.js`); [docs/flower-variations.md](docs/flower-variations.md)
names every variation, matching the Floral_Prototype editor's dropdowns.

## Controls

- **Petals** — how many mirrored slices the rings are cut into, one petal per slice (3–20).
  Arrow keys nudge it.
- **Lock petals when randomizing** (`L`) — on by default; turn it off and Randomize also picks
  a petal count suited to the current direction. While it is off, a row underneath sets the
  fewest and most petals Randomize may pick for that direction (it starts at the direction's
  own range; Reset goes back to it). The overview cards use these ranges too.
- **Randomize** (`Space`) / **Back** — a new design, or the previous one.
- **Show ring grid** (`G`) — overlays the rings and slice lines. With the grid on, drag the inner
  rings to resize the pattern (the outer petal ring stays fixed).
- **Export** — SVG or PNG.

The current direction, seed, petal count and any resized rings are kept in the URL, so a link
reopens the same flower. (In code and in the URL the petal count is still called `folds`.)

## Original panel descriptions

The panel descriptions were shortened. The full original text for each direction, as shown in
the panel (the last sentence was shared by all four):

- **0. Giorgia Lupi (trial)** — Flat, printed colour and fine-line hatching on a paper tile, after Giorgia Lupi’s flowers for the Binghamton University Libraries installation. Every flower is built on three concentric rings (core, middle, petal), all cut into the same number of mirrored folds.
- **1. Translucent** — Scanned flowers with translucent, butterfly-wing petals: a soft ink wash, fine veins, and a blurred ink centre. The colours come from pressed-flower studies. Every flower is built on three concentric rings (core, middle, petal), all cut into the same number of mirrored folds.
- **2. Playful** — Simple cut-paper flowers in flat, vibrant colour, with chunky rounded shapes, hand-cut edges, and sheets layered one over another. Every flower is built on three concentric rings (core, middle, petal), all cut into the same number of mirrored folds.
- **3. Painterly** — Saturated painted flowers on black felt, worked with visible brush strokes and wet blotches of a second colour, with ragged edges and watercolour-paper grain. Every flower is built on three concentric rings (core, middle, petal), all cut into the same number of mirrored folds.

## Specimen section (hidden)

The panel has a **Specimen** section that describes each flower in words (petal, middle and
core recipe, plus its palette). It is hidden for now: to show it again, remove the `hidden`
attribute from `<section class="recipe">` in [index.html](index.html). The app keeps it up to
date either way.

## Running locally

No build step. Serve the folder with the dev server:

```bash
python3 tools/dev-server.py 5178
```

It turns browser caching off, and while the page is open on localhost it reloads itself whenever a
source file changes. Seeds live in the URL, so the same flowers come back drawn under the current
rules (a Garden rule change shows up on the 20 flowers already on screen). Back history survives.

Reference images live in `visual-ref/`, which is git-ignored.
