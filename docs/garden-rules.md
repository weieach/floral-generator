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
it (exit code 1 if any do).

All code references are in [butterfly.js](../butterfly.js): the `GARDEN` settings block
([line 45](../butterfly.js#L45)), `makeLayer` ([line 94](../butterfly.js#L94)) and `makeDesign`.

**Status as of 2026-11-19: every rule is implemented and passes** (20,000 flowers in each colour mode,
0 violations). T7 and the narrowing of T6 / S1 to lanceolate only were made on this date: the deployed
site does not have them yet.

## Decision tree process

| # | Step | Status | How |
|---|---|---|---|
| D1 | 1 layer or 2 layers, 1:1 chance | ✅ | `backChance: 0.5`, drawn before either layer ([line 157](../butterfly.js#L157)). Measured 49.8% / 50.3% two-layer |
| D2 | Front layer petal shape | ✅ | The front layer is made next, knowing the layer count |
| D3 | Back layer petal shape (if a second layer is allocated) | ✅ | Made after the front layer, so it can follow the front's shape and tip |

The palette, ink, centre size and wash are drawn before step D1; they don't depend on the tree.

## Conditional rules

| Id | Rule | Status | How |
|---|---|---|---|
| | **If 1 layer** | | |
| L1 | 5–8 petals | ✅ | `folds` weights 5 › 6 › 7 › 8 ([line 179](../butterfly.js#L179)) |
| L2 | Spatulate shape: 5–6 petals | ✅ | `spoonFolds` |
| | **If 2 layers** | | |
| T1 | Ink-dipped tips on ≤1 layer | ✅ | Follows from T4: the back tip is always below the front's, so it is never ink-dipped |
| T2 | No spatulate petals on either layer | ✅ | Shape list filtered when `twoLayers` ([line 96](../butterfly.js#L96)) |
| T3 | Tip dots on ≤1 layer | ✅ | `noDots` on the back layer when the front has dots |
| T4 | Back tip may not exceed the front tip in the hierarchy ink-dipped › deep colour › scorched › plain, nor share its category (both plain is fine) | ✅ | `backTip` ([line 88](../butterfly.js#L88)) steps the back tip down, or drops it |
| T5 | Within a category, specific colour counts too (e.g. black › purple) | ✅ | Applied as: the back tip's colour may never be darker than the front tip's, in any category. Since T4 forbids sharing a category, this is where colour still matters (a scorch brown behind a pale deep-colour tip becomes plain) |
| T6 | Back layer has no lanceolate petals | ✅ | Shape list filtered for the back layer (`pointed`, [line 58](../butterfly.js#L58)); back layers are elliptic, ovate or orbicular |
| T7 | If either layer is scorched, the other has no tip dots | ✅ new | Front scorched → back `noDots`; front has dots → back may not be scorched (`frontDots`, [line 124](../butterfly.js#L124)). Was broken in ~2.5% of two-layer flowers before |
| | **If petal shape = lanceolate** | | |
| S1 | No three tip dots | ✅ | A three-dot draw becomes one dot ([line 120](../butterfly.js#L120)) |

## Remove completely

| Id | Rule | Status | How |
|---|---|---|---|
| X1 | Petal edges: no scalloped, no serrated | ✅ | `edges` offers smooth or notched only ([line 56](../butterfly.js#L56)) |
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
was undone on 2026-11-19 (`pointed: ['lanceolate']`, [line 58](../butterfly.js#L58)).

## Changelog

- **2026-11-19**: T6 and S1 narrowed to lanceolate only (E2 withdrawn; ovate allowed on back layers and
  with three tip dots again). Added T7 (scorched layer → no tip dots on the other layer). Added the Full
  colour range switch (E4). Wrote this file and `tools/check-garden-rules.js`.
- **2026-11-18**: Ovate added to the lanceolate rules (E2). Back layer: no lanceolate (T6). Back tip colour
  may not be darker than the front's (T5). Back tip must be a lower category (T4). 1:1 layer odds (D1).
  Tip dots on ≤1 layer (T3). One-layer petal counts (L1, L2). No spatulate with two layers (T2). Ink on
  ≤1 layer (T1). Two-layer petal counts (E1). No scalloped/serrated edges, no fans (X1, X2).
