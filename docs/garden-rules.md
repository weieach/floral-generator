# Garden randomization: rules and status

The rules the **Garden randomization** tab follows, whether each one is in the code, and how it was
checked. Terms (front/back layer, tip categories, tip dots) are defined in
[flower-variations.md](flower-variations.md).

**Keep this file current.** When a rule is added or changed, update its row here, add a check for it to
[tools/check-garden-rules.js](../tools/check-garden-rules.js) (same rule id), run it, and add a line to the
changelog at the bottom.

```bash
node tools/check-garden-rules.js
```

It generates 20,000 Garden flowers in each colour mode and reports, for each rule id below, how many break
it; rules about odds can be checked as a share against a limit (`SHARES`). Exit code 1 if anything fails.

All code references are in [butterfly.js](../butterfly.js): the `GARDEN` settings block
([line 47](../butterfly.js#L47)), `makeLayer` ([line 97](../butterfly.js#L97)) and `makeDesign`.

**Status as of 2026-11-20: every rule is implemented, passes, and is live** (20,000 flowers in each
colour mode, 0 violations). Deployed together on this date: T8, T9, T11, T12, T14, T15, S2 and S3,
with T10 and T13 withdrawn.

## Decision tree process

| # | Step | Status | How |
|---|---|---|---|
| D1 | 1 layer or 2 layers, 1:1 chance | ✅ | `backChance: 0.5`, drawn before either layer ([line 170](../butterfly.js#L170)). Measured 49.9% / 50.4% two-layer |
| D2 | Front layer petal shape | ✅ | The front layer is made next, knowing the layer count |
| D3 | Back layer petal shape (if a second layer is allocated) | ✅ | Made after the front layer, so it can follow the front's shape and tip |

The palette, ink, centre size and wash are drawn before step D1; they don't depend on the tree.

## Conditional rules

| Id | Rule | Status | How |
|---|---|---|---|
| | **If 1 layer** | | |
| L1 | 5–8 petals | ✅ | `folds` weights 5 › 6 › 7 › 8 ([line 210](../butterfly.js#L210)) |
| L2 | Spatulate shape: 5–6 petals | ✅ | `spoonFolds` |
| | **If 2 layers** | | |
| T1 | Ink-dipped tips on ≤1 layer | ✅ | Follows from T8: the back tip is never a coloured dip |
| T2 | No spatulate petals on either layer | ✅ | Shape list filtered when `twoLayers` ([line 93](../butterfly.js#L93)) |
| T3 | Tip dots on ≤1 layer | ✅ | Follows from T8: dots sit inside a coloured dip, which only the front can have |
| T4 | Back tip may not exceed the front tip in the hierarchy ink-dipped › deep colour › scorched › plain, nor share its category (both plain is fine) | ✅ | With T8 this means: a scorched back only behind an ink-dipped or deep-coloured front; behind a scorched or plain front the back is plain (`burnOK`, [line 134](../butterfly.js#L134)) |
| T5 | Within a category, specific colour counts too (e.g. black › purple) | ✅ | Applied as: the back tip's colour may never be darker than the front tip's, in any category. With T8 this is the scorch brown against the front tip: behind a pale deep-colour tip the back becomes plain |
| T6 | Back layer has no lanceolate petals | ✅ | Shape list filtered for the back layer (`gardenShapes`, `pointed`, [line 60](../butterfly.js#L60)); back layers are elliptic, ovate or orbicular |
| T7 | If either layer is scorched, the other has no tip dots | ✅ | Front has dots → back may not be scorched (`frontDots`, [line 134](../butterfly.js#L134)); a scorched front means a plain back (T4), so the back can't have dots either |
| T8 | Back tip can only be scorched or plain | ✅ | The back layer never gets a coloured dip ([line 133](../butterfly.js#L133)) |
| T9 | Lanceolate petals have no tip dots | ✅ | Dots are cleared on lanceolate petals when `twoLayers` ([line 125](../butterfly.js#L125)). Only the front can be lanceolate (T6) |
| T10 | ~~If the top layer's tip is plain, set it apart from the bottom layer (soft outline, then deep-coloured edges and a darker heart)~~ | ❌ withdrawn | Removed 2026-11-19 at your request; plain-tipped front layers get no extra treatment |
| T11 | No outline, deep-coloured edges or darker centre on plain-tipped petals | ✅ | Nothing is added; the check confirms no flower carries any of them |
| T12 | If the front layer is orbicular, the back layer can't be orbicular | ✅ new | `gardenShapes` ([line 93](../butterfly.js#L93)) drops orbicular from the back layer's list when `frontShape` is orbicular, so the back is elliptic or ovate |
| T13 | ~~Make it less likely that both layers have plain tips and the same tint (the back layer took the palette's deeper wash)~~ | ❌ withdrawn | Removed 2026-11-19: it darkened the bottom layer and gave it a different hue. Replaced by T15 + T14 |
| T14 | When the front and back layers' washes are the same colour, make the front layer subtly darker | ✅ new | "Same colour" = washes under 10 RGB steps apart, i.e. indistinguishable (`sameTint`, [line 67](../butterfly.js#L67)); exact hex matches are rare, but 85% of two-layer flowers are this close. The front wash is then mixed 3.2% toward the ink (`frontDarken`; first 8%, cut by 60%), starting from whichever of the two washes is darker so the front always ends up the darker layer. It darkens without shifting the hue ([line 191](../butterfly.js#L191)). No random draws, so seeds are unchanged apart from that shade. Plain/plain flowers always qualify, since T15 gives them matching washes |
| T15 | If both layers have plain tips, they have the same hue, and the bottom layer is never darkened | ✅ new | The back layer takes the front's wash ([line 182](../butterfly.js#L182)), then T14 makes the front subtly darker. A single-wash flower could otherwise pick a different light colour for each layer. Checked: same hue (within 12°) and the back no darker than the front |
| | **If petal shape = lanceolate** | | |
| S1 | No three tip dots | ✅ | A three-dot draw becomes one dot ([line 125](../butterfly.js#L125)); with two layers T9 removes the dots entirely, so this matters for one-layer flowers |
| | **If petal shape = ovate** | | |
| S2 | At most one tip dot | ✅ new | `oneDot` ([line 61](../butterfly.js#L61)): a three-dot draw becomes one dot ([line 125](../butterfly.js#L125)) |
| | **If petal shape = spatulate** | | |
| S3 | Petal width at most 1.18 (other shapes go up to 1.38) | ✅ new | `spoonMaxWidth` ([line 62](../butterfly.js#L62)), used in the width draw ([line 143](../butterfly.js#L143)). Wider spoon petals close into one round disc with only thin stalks showing near the centre; up to about 1.16 each petal still reads on its own |

Three tip dots now only appear on elliptic, spatulate and orbicular petals.

With T4, T5, T7 and T8 together, two-layer flowers come out as (front / back tip): deep / plain 37%,
ink / plain 33%, ink / scorched 14%, scorched / plain 8%, plain / plain 7%, deep / scorched 1%.

## Remove completely

| Id | Rule | Status | How |
|---|---|---|---|
| X1 | Petal edges: no scalloped, no serrated | ✅ | `edges` offers smooth or notched only ([line 58](../butterfly.js#L58)) |
| X2 | Petal shape: no fan | ✅ | Fan is not in the Garden's shape list |

## Rules from chat that aren't in the decision-tree document

| Id | Rule | Status |
|---|---|---|
| E1 | 2 layers: 5–7 petals per layer, evenly | ✅ checked |
| E2 | ~~Ovate counts as "lanceolate" for T6 and S1~~ | ❌ withdrawn 2026-11-19: "lanceolate" means the prototype's Lanceolate option only (see below) |
| E3 | Weighting toward the favourites: few spoon petals, two-tone washes (88%), ink-dipped front tips, blue / coral / violet palettes | ✅ (odds, not a hard rule) |
| E4 | **Full colour range** switch: every palette and wash equally likely; recolours the same flowers | ✅ checked (all rules pass in both modes) |

## What counts as lanceolate (settled)

"Lanceolate" means the Floral_Prototype editor's **Lanceolate** option, which is the same geometry as
`lanceolate` here (spear-shaped: widest about a third of the way out, straight sides to a sharp point).
Ovate is not included. On 2026-11-18 the rules had been widened to ovate from a misread screenshot; that
was undone on 2026-11-19 (`pointed: ['lanceolate']`, [line 60](../butterfly.js#L60)).

## Changelog

- **2026-11-20**: Deployed everything since `e37b3b9` (rules above, the bare Garden cards, and the
  local dev server with auto-refresh).
- **2026-11-19 (after deploy `e37b3b9`)**: Withdrew T13 (it darkened the bottom layer and changed its
  hue). Added T15: two plain layers share the front's hue, and only the front is darkened (T14).
  T14 darkening cut by 60% (8% → 3.2%), now measured from the
  darker of the two washes. Added T14 (front wash darker when both layers share a colour). T13 retint chance raised from 80% to 95%. Added T13 (two plain-tipped layers: the back usually gets its own
  deeper tint). Added T12 (no orbicular back layer behind an orbicular
  front). Added S3 (spatulate petals no wider than 1.18). Withdrew T10 entirely: no outline, deep-coloured edges or
  darker centre on plain-tipped front layers (T11 records this). Earlier the same day: removed the
  outline / edges, keeping only the darker heart. Added T10 (plain-tipped front layer of a two-layer flower: deep-coloured
  edges and a darker heart where the petals overlap; first drawn as a soft outline, then changed to
  match the deep-tip treatment). Added S2 (ovate: at most one tip dot). Added T9 (two layers: no tip dots on lanceolate petals).
  Added T8 (back tip scorched or plain only); T1 and T3 now follow from it.
- **2026-11-19**: T6 and S1 narrowed to lanceolate only (E2 withdrawn; ovate allowed on back layers and
  with three tip dots again). Added T7 (scorched layer → no tip dots on the other layer). Added the Full
  colour range switch (E4). Wrote this file and `tools/check-garden-rules.js`.
- **2026-11-18**: Ovate added to the lanceolate rules (E2). Back layer: no lanceolate (T6). Back tip colour
  may not be darker than the front's (T5). Back tip must be a lower category (T4). 1:1 layer odds (D1).
  Tip dots on ≤1 layer (T3). One-layer petal counts (L1, L2). No spatulate with two layers (T2). Ink on
  ≤1 layer (T1). Two-layer petal counts (E1). No scalloped/serrated edges, no fans (X1, X2).
