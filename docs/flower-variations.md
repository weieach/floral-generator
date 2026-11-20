# Flower variations: names and options

A glossary of every variation a Translucent flower can have. The names come from the
**Floral_Prototype** editor (the dropdowns down its left-hand panel, `Floral_Prototype/butterfly.js` →
`CONTROLS`, `GRADIENT_CONTROLS`, `PRESETS`; animations in `Floral_Prototype/animate.js`), read at its
commit `65ab3d9` ("remove fan"). Each entry gives the label you see in the editor, the value the code
uses, and where the same thing lives in this repo, so the two can be talked about with one vocabulary.

The Garden randomization tab here draws from the same set; [garden-rules.md](garden-rules.md) lists the
rules it applies on top.

## Shared terms

| Say | Means | In code |
|---|---|---|
| **Front layer** / primary layer | The full-length petals, drawn on top | `d.main` (`role: 'main'`) |
| **Back layer** / secondary layer | The optional second ring of petals, shorter, set between the front petals and drawn behind them | `d.back` (`role: 'back'`), `null` when there is one layer |
| **Petal count** | Petals per layer; both layers always have the same count | `folds` (`n` in the renderer, `d.folds` on a Garden flower) |
| **Petal tip** | The treatment at the end of each petal: one of four categories (below) | `L.tip` (a coloured dip) or `L.tipBurn` (scorched) |
| **Tip dots** | Small dots inside a coloured dip | `L.tip.eyes` |
| **Palette** / colour theme | One of nine colour sets | `d.pal` |

## Editor dropdowns

### Number of petals (slider)
Range **5–14**, default **5** in the prototype. Here the Translucent tab's range is the same (default 8);
Garden flowers pick their own count (5–8). Code: `folds`.

### Color theme
Nine palettes sampled from pressed-flower photos. Each has three wash colours (`wash`, sorted dark to
light), a tinted ink (`ink`), a scorch brown (`burn`) and a paper colour (`paper`). Code:
`PALETTES` ([butterfly.js:18](../butterfly.js#L18)), option value = palette name.

| Option | Character |
|---|---|
| Columbine | dusty pink and lilac |
| Pansy | deep violet |
| Forget-me-not | soft blue with a cream light |
| Hydrangea | mauve and peach |
| Bellflower | blue-violet |
| Nigella | pale sage and grey-blue |
| Pimpernel | coral |
| Bleeding heart | rose pink |
| Fern & violet | olive green and lilac |

### Petal shape
The outline of a front petal, defined as a half-width profile along the petal
(`SHAPES`, [flora.js:115](../flora.js#L115); "widest point" is the `peak` value, 0 = base, 1 = tip).

| Option | Code value | Outline |
|---|---|---|
| Ovate | `ovate` | Egg: widest about 40% of the way out, bulging, ending in a softened point |
| Elliptic | `elliptic` | Oval: widest at the middle, rounded tip |
| Lanceolate | `lanceolate` | Spear: widest about a third of the way out, then straight sides tapering to a sharp point. Reads as a star when narrow |
| Spatulate | `spatulate` | Spoon: narrow stalk, widest about 70% out, round tip |
| Orbicular | `orbicular` | Round: widest at the middle, very blunt round tip |
| Fan | `flabellate` | Open wedge that widens all the way out and ends in a rounded cap |

How a shape reads also depends on petal width (`L.width`, not an editor control): a narrow ovate petal
can look close to a lanceolate one.

### Petal edge
| Option | Code value | Look |
|---|---|---|
| Smooth | `none` | Plain outline |
| Notched | `notch` | A small cleft at the tip, heart-like |

Scalloped (`scallop`) and serrated (`serrate`) edges were removed from the prototype and from the Garden.
The Translucent tab here still has them.

### Petal tips
Four categories, deepest first. Code: `tipKind` in the prototype; here `tipRank`
([butterfly.js:81](../butterfly.js#L81)) numbers them 3 → 0.

| Option | Code value | Look | In code |
|---|---|---|---|
| Ink-dipped | `ink` | The tip fades into ink. The ink is plain black ("sumi", `#1d1a1b`) on about 40% of flowers, otherwise the palette's tinted ink | `L.tip.colour === d.ink` |
| Deep color | `deep` | The tip fades into the palette's deepest wash colour, mixed with a little ink | `L.tip` with any other colour |
| Scorched | `scorched` | No coloured dip; a small soft brown burn mark at the very tip, in the palette's `burn` colour | `L.tipBurn: true` |
| Plain | `none` | No tip treatment | no `L.tip`, `L.tipBurn: false` |

How far down the petal a dip reaches is the flower's **tip size** (`d.tip`, ring III).

### Tip dots
Dots inside a coloured dip, so they only appear with **Ink-dipped** or **Deep color** tips.

| Option | Code value | `L.tip.eyes` | Look |
|---|---|---|---|
| None | `none` | 0 | — |
| One | `one` | 1 | One dot on the centre line |
| Three | `three` | 2 | One dot with two smaller dots above it |

### Petal layers
| Option | Code value | In code |
|---|---|---|
| One | `1` | `d.back === null` |
| Two | `2` | `d.back` is a second layer, offset by half a petal |

### Back petal shape
The same shapes as **Petal shape** except **Fan**, applied to the back layer (`d.back.shape`). Only
used when there are two layers.

## Gradient section (prototype only)
Fine-tuning controls; this repo has no equivalent controls, but each maps to a design field.

| Control | Type | Sets | Design field |
|---|---|---|---|
| Preset | dropdown: None, Custom, **Cream & smoke** | A saved combination of the controls below plus shapes and petal count | — |
| Inner color | colour | Front-layer wash near the centre | `main.base` |
| Outer color | colour | Front-layer wash toward the tip | `main.toward` |
| Color shift position | 5–95% | Where along the petal the inner colour turns into the outer | `L.gradMid` |
| Petal opacity | 15–100% | How solid the petal wash is | `L.bodyAlpha` |
| Tip color | colour | Colour of the front tip dip (turns a dip on) | `main.tip.colour` |
| Tip size | 5–45% | How far the dip reaches down the petal | `d.tip` (ring III) |
| Back layer color | colour | A flat wash for the back layer | `back.base`, `back.toward` |
| Center color | colour | The blurred centre | `d.centre.colour` |

## Animation (prototype only)
None · Fade in one petal at a time · Pulse center · Center-out ripple · Whole-flower breath · Sway ·
Bloom. **Replay** restarts the one-shot animation (Fade in).

## Buttons (prototype)
**Shuffle**: a new seed; dropdowns you have set keep their value. **Reset**: every dropdown and
gradient control back to **Auto** (the seed's own choice; each Auto option names what the seed picked).

## Variations this repo has that the editor doesn't list
| Name | Options | In code |
|---|---|---|
| Two-tone wash | yellow → blue, peach → periwinkle, lemon → lilac, blush → aqua, cream → cornflower, or a single wash | `d.twoTone` (`TWO_TONES`, [butterfly.js:31](../butterfly.js#L31)) |
| Ink | sumi black or the palette's tinted ink | `d.ink` |
| Full colour range (Garden switch) | off: palettes and washes weighted toward the favourites; on: all equally likely | `GARDEN_FULL` ([butterfly.js:67](../butterfly.js#L67)) |

## Differences between the prototype and this repo
- The prototype still offers **Fan** for the front layer; the Garden never uses it.
- The prototype deepens petal bodies toward the palette's strongest colour and draws on white; this
  repo keeps paler washes on a textured paper ground.
- The same seed gives a different flower in each (and the Garden differs from the Translucent tab).
