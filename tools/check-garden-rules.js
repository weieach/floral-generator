#!/usr/bin/env node
/* Checks every Garden randomization rule (docs/garden-rules.md) against generated flowers.
 *
 *   node tools/check-garden-rules.js [count]
 *
 * Generates `count` Garden flowers (default 20,000) in each colour mode and counts how many
 * break each rule. Rule ids match docs/garden-rules.md; add a line here when a rule is added.
 */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = global;
if (!global.crypto) global.crypto = require('crypto').webcrypto; // built in from Node 19
for (const f of ['flora.js', 'butterfly.js']) (0, eval)(fs.readFileSync(path.join(root, f), 'utf8'));
const G = window.Flora.garden;

const lum = h => { const v = parseInt(h.slice(1), 16); return 0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255); };
const layers = d => [d.main, d.back].filter(Boolean);
const ink = (d, L) => !!(L.tip && L.tip.colour === d.ink);
const dots = L => (L.tip ? L.tip.eyes : 0); // 0 none, 1 one dot, 2 three dots
const rank = (d, L) => (L.tip ? (ink(d, L) ? 3 : 2) : L.tipBurn ? 1 : 0); // ink > deep > scorched > plain
const tipColour = (d, L) => (L.tip ? L.tip.colour : L.tipBurn ? d.pal.burn : null);
const two = d => !!d.back;
const rgbOf = h => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const tintGap = (a, b) => { const A = rgbOf(a), B = rgbOf(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const plain = L => !L.tip && !L.tipBurn;
const hueOf = h => { // HSL hue in degrees
  const [r, g, b] = rgbOf(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (!c) return 0;
  const x = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return (x * 60 + 360) % 360;
};
const hueGap = (a, b) => { const d = Math.abs(hueOf(a) - hueOf(b)); return Math.min(d, 360 - d); };

const RULES = [
  ['L1', '1 layer: 5–8 petals', d => two(d) || (d.folds >= 5 && d.folds <= 8)],
  ['L2', '1 layer, spatulate: 5–6 petals', d => two(d) || d.main.shape !== 'spatulate' || d.folds <= 6],
  ['T1', '2 layers: ink-dipped tips on ≤1 layer', d => !two(d) || !(ink(d, d.main) && ink(d, d.back))],
  ['T2', '2 layers: no spatulate petals on either layer', d => !two(d) || layers(d).every(L => L.shape !== 'spatulate')],
  ['T3', '2 layers: tip dots on ≤1 layer', d => !two(d) || !(dots(d.main) && dots(d.back))],
  ['T4', '2 layers: back tip in a lower category than front (both plain is fine)', d => {
    if (!two(d)) return true;
    const a = rank(d, d.main), b = rank(d, d.back);
    return b < a || (a === 0 && b === 0);
  }],
  ['T5', '2 layers: back tip colour no darker than front tip colour', d => {
    if (!two(d)) return true;
    const a = tipColour(d, d.main), b = tipColour(d, d.back);
    return !a || !b || lum(b) >= lum(a);
  }],
  ['T6', '2 layers: back layer not lanceolate', d => !two(d) || d.back.shape !== 'lanceolate'],
  ['T7', '2 layers: a scorched layer means no tip dots on the other layer', d =>
    !two(d) || !((d.main.tipBurn && dots(d.back)) || (d.back.tipBurn && dots(d.main)))],
  ['T8', '2 layers: back tip is scorched or plain only', d => !two(d) || !d.back.tip],
  ['T9', '2 layers: lanceolate petals have no tip dots', d => !two(d) || layers(d).every(L => L.shape !== 'lanceolate' || !dots(L))],
  ['T11', 'no outline, deep-coloured edges or darker heart (T10 withdrawn)', d =>
    !d.heartDeep && layers(d).every(L => !L.softEdges && !L.softOutline)],
  ['T12', '2 layers: an orbicular front means a back that isn\'t orbicular', d => !two(d) || !(d.main.shape === 'orbicular' && d.back.shape === 'orbicular')],
  ['T14', '2 layers: front and back washes never the same colour (the front is darkened)', d => {
    if (!two(d)) return true;
    const gap = (tintGap(d.main.base, d.back.base) + tintGap(d.main.toward, d.back.toward)) / 2;
    return gap >= 10 || (d.main.darkened && lum(d.main.base) < lum(d.back.base));
  }],
  ['T15', '2 layers, both plain-tipped: same hue on both layers, back never darker than front', d => {
    if (!two(d) || !plain(d.main) || !plain(d.back)) return true;
    return d.back.matched && hueGap(d.main.base, d.back.base) < 12 && hueGap(d.main.toward, d.back.toward) < 12 &&
      lum(d.back.base) >= lum(d.main.base) && lum(d.back.toward) >= lum(d.main.toward);
  }],
  ['T16', '2 layers: no notched edges on either layer', d => !two(d) || layers(d).every(L => L.edge === 'none')],
  ['T17', 'alternating tip dots only with an even petal count and tip dots, and the drawing alternates', d => {
    if (!layers(d).some(L => L.tip && L.tip.alternate)) return true;
    if (d.folds % 2 || !dots(d.main) || (d.back && d.back.tip && d.back.tip.alternate)) return false;
    const svg = G.renderSVG(d, d.folds, { bare: true });
    const units = [...svg.matchAll(/main-unit(-plain)?" transform/g)].map(m => !!m[1]);
    return units.length === d.folds && units.every((plain, i) => plain === (i % 2 === 1));
  }],
  ['S1', 'lanceolate petals: no three tip dots', d => layers(d).every(L => L.shape !== 'lanceolate' || dots(L) < 2)],
  ['S2', 'ovate petals: at most one tip dot', d => layers(d).every(L => L.shape !== 'ovate' || dots(L) <= 1)],
  ['S3', 'spatulate front petals: width ≤ 1.18', d => d.main.shape !== 'spatulate' || d.main.width <= 1.18],
  ['X1', 'no scalloped or serrated edges', d => layers(d).every(L => L.edge === 'none' || L.edge === 'notch')],
  ['X2', 'no fan (flabellate) petals', d => layers(d).every(L => L.shape !== 'flabellate')],
  ['E1', '2 layers: 5–7 petals per layer', d => !two(d) || (d.folds >= 5 && d.folds <= 7)],
];

// Rules about odds rather than single flowers: [id, name, measure(flowers) → share, max share]
const SHARES = [
  ['T17', 'even petal count with tip dots: how far the alternating share is from 50%', flowers => {
    const el = flowers.filter(d => d.folds % 2 === 0 && dots(d.main));
    return Math.abs(el.filter(d => d.main.tip.alternate).length / (el.length || 1) - 0.5);
  }, 0.05],
  ['S4', '1 layer, lanceolate with a coloured tip: share with a tip dot (was 38%)', flowers => {
    const lance = flowers.filter(d => !two(d) && d.main.shape === 'lanceolate' && d.main.tip);
    return lance.filter(d => d.main.tip.eyes > 0).length / (lance.length || 1);
  }, 0.15],
];

const N = +process.argv[2] || 20000;
let failed = 0;
for (const full of [false, true]) {
  const fails = RULES.map(() => 0);
  let twoLayer = 0;
  const flowers = [];
  for (let i = 0; i < N; i++) {
    const d = G.makeDesign(window.Flora.randomSeed(), full);
    if (two(d)) twoLayer++;
    RULES.forEach(([, , ok], k) => { if (!ok(d)) fails[k]++; });
    flowers.push(d);
  }
  console.log(`\n${full ? 'Full colour range' : 'Default colours'}: ${N} flowers, ${(twoLayer / N * 100).toFixed(1)}% two-layer (D1 target 50%)`);
  RULES.forEach(([id, name], k) => {
    console.log(`  ${fails[k] ? 'FAIL' : 'ok  '}  ${id.padEnd(4)} ${name}${fails[k] ? `  (${fails[k]} flowers)` : ''}`);
    failed += fails[k];
  });
  for (const [id, name, measure, max] of SHARES) {
    const share = measure(flowers), bad = share > max;
    console.log(`  ${bad ? 'FAIL' : 'ok  '}  ${id.padEnd(4)} ${name}: ${(share * 100).toFixed(0)}% (limit ${max * 100}%)`);
    if (bad) failed++;
  }
}
process.exit(failed ? 1 : 0);
