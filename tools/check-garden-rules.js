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
  ['S1', 'lanceolate petals: no three tip dots', d => layers(d).every(L => L.shape !== 'lanceolate' || dots(L) < 2)],
  ['X1', 'no scalloped or serrated edges', d => layers(d).every(L => L.edge === 'none' || L.edge === 'notch')],
  ['X2', 'no fan (flabellate) petals', d => layers(d).every(L => L.shape !== 'flabellate')],
  ['E1', '2 layers: 5–7 petals per layer', d => !two(d) || (d.folds >= 5 && d.folds <= 7)],
];

const N = +process.argv[2] || 20000;
let failed = 0;
for (const full of [false, true]) {
  const fails = RULES.map(() => 0);
  let twoLayer = 0;
  for (let i = 0; i < N; i++) {
    const d = G.makeDesign(window.Flora.randomSeed(), full);
    if (two(d)) twoLayer++;
    RULES.forEach(([, , ok], k) => { if (!ok(d)) fails[k]++; });
  }
  console.log(`\n${full ? 'Full colour range' : 'Default colours'}: ${N} flowers, ${(twoLayer / N * 100).toFixed(1)}% two-layer (D1 target 50%)`);
  RULES.forEach(([id, name], k) => {
    console.log(`  ${fails[k] ? 'FAIL' : 'ok  '}  ${id.padEnd(3)} ${name}${fails[k] ? `  (${fails[k]} flowers)` : ''}`);
    failed += fails[k];
  });
}
process.exit(failed ? 1 : 0);
