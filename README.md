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

The first tab, **All style overview**, shows every direction in a 2×2 grid for the same seed,
each at its own petal count, with just Randomize and Back. Click a flower to open it in its own tab.

## Controls

- **Petals** — how many mirrored slices the rings are cut into, one petal per slice (3–20).
  Arrow keys nudge it.
- **Lock petals when randomizing** (`L`) — on by default; turn it off and Randomize also picks
  a petal count suited to the current direction.
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

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5178
```

Reference images live in `visual-ref/`, which is git-ignored.
