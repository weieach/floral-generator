/* Radial Flora — geometry + SVG rendering.
 *
 * A flower is three concentric rings:  I core (0..r1), II middle (r1..r2), III petal ring (r2..R).
 * The rings are cut into `folds` identical slices. Everything inside a slice is drawn
 * mirror-symmetric about the slice's centre line, so the result has full dihedral symmetry.
 *
 * makeDesign(seed) draws every random decision up front, independent of the fold count,
 * so moving the Folds slider re-renders the *same* flower with a different symmetry.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const R = 400;    // outer edge of the petal ring
  const HALF = 500; // tile spans -500..500

  // ---------- seeded randomness ----------
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const next = mulberry32(hashSeed(String(seed)));
    return {
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => a + Math.floor((b - a + 1) * next()),
      chance: p => next() < p,
      pick: arr => arr[Math.floor(next() * arr.length)],
      weighted(entries) {
        const live = entries.filter(e => e[1] > 0);
        let x = next() * live.reduce((s, e) => s + e[1], 0);
        for (const [v, w] of live) if ((x -= w) < 0) return v;
        return live[live.length - 1][0];
      },
    };
  }
  const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomSeed() {
    const buf = new Uint32Array(5);
    crypto.getRandomValues(buf);
    return Array.from(buf, v => SEED_CHARS[v % SEED_CHARS.length]).join('');
  }

  // ---------- colour ----------
  function rgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join('');
  }

  // Sampled from the Binghamton Libraries flowers and the pressed-flower references.
  const PALETTES = [
    { name: 'Fern',       petal: ['#2f5d4a', '#4f8466'], mid: ['#ead6ca', '#b89e90'], core: ['#2a2626', '#efe4da'], ink: '#1e2622', light: '#f4ebe2', accent: '#5e8a74' },
    { name: 'Cornflower', petal: ['#4a6fc6', '#2f4f9e'], mid: ['#3e6a4f', '#a8c6b2'], core: ['#1c1e26', '#d9e2f2'], ink: '#171a24', light: '#eef1f6', accent: '#5566d4' },
    { name: 'Peony',      petal: ['#e488b8', '#c5508e'], mid: ['#2c2f52', '#a3abd2'], core: ['#1d1c2b', '#f6d9e7'], ink: '#4a1d38', light: '#f9e6ef', accent: '#f2557a' },
    { name: 'Lagoon',     petal: ['#3a95b3', '#226f8c'], mid: ['#1f2227', '#79c0d2'], core: ['#121417', '#d6eef4'], ink: '#0f2229', light: '#e4f3f6', accent: '#1597b5' },
    { name: 'Apricot',    petal: ['#8c2f22', '#eea27d'], mid: ['#f6da8f', '#f19c7f'], core: ['#191716', '#fcefc8'], ink: '#4f1a12', light: '#fdf1d6', accent: '#ddd06a' },
    { name: 'Lilac',      petal: ['#9a80d3', '#6a4cae'], mid: ['#d4c5f2', '#43357f'], core: ['#261d44', '#efe9fb'], ink: '#2e2257', light: '#f1ecfb', accent: '#b493d8' },
    { name: 'Celadon',    petal: ['#6fb7a2', '#2f7d6b'], mid: ['#f1ebdf', '#2b5a52'], core: ['#1d3833', '#e5f2ed'], ink: '#1c3a34', light: '#f2f6f1', accent: '#73dcbc' },
    { name: 'Pressed',    petal: ['#c98aa2', '#dcab84'], mid: ['#6e60aa', '#e8c65e'], core: ['#3a2836', '#f6e8e9'], ink: '#4e3b2e', light: '#f8ecec', accent: '#cf9fb4' },
    { name: 'Pansy',      petal: ['#3d307e', '#7a73cc'], mid: ['#f1c93c', '#251d40'], core: ['#17112a', '#fbefc2'], ink: '#140f26', light: '#f3f0fb', accent: '#7468cc' },
    { name: 'Inkwell',    petal: ['#2b2e3a', '#5d6580'], mid: ['#efe6da', '#a39b8f'], core: ['#121212', '#f6f1ea'], ink: '#111216', light: '#f7f2ea', accent: '#5f7fa6' },
    { name: 'Hydrangea',  petal: ['#b99bd3', '#e3b493'], mid: ['#7d4d7f', '#f3dfe7'], core: ['#3a2440', '#fbeef0'], ink: '#3e2a3f', light: '#fbf1ef', accent: '#c895c9' },
    { name: 'Columbine',  petal: ['#8e3a5c', '#e2a2b9'], mid: ['#f0e3c4', '#c7b26a'], core: ['#3d1d2b', '#fff4dd'], ink: '#3b1426', light: '#fbf0ea', accent: '#e46f8f' },
  ];

  // ---------- geometry helpers ----------
  const f1 = v => Math.round(v * 10) / 10;
  const pt = p => f1(p[0]) + ' ' + f1(p[1]);
  const polar = (r, a) => [r * Math.sin(a), -r * Math.cos(a)]; // angle 0 = straight up, clockwise
  const toDeg = a => f1(a * 180 / Math.PI);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const poly = (pts, close = true) => 'M' + pts.map(pt).join('L') + (close ? 'Z' : '');
  const odd = m => (m % 2 ? m : Math.max(1, m - 1));

  function el(tag, a, inner) {
    let s = '<' + tag;
    for (const k in a) {
      const v = a[k];
      if (v === undefined || v === null || v === false) continue;
      s += ` ${k}="${typeof v === 'number' ? f1(v) : v}"`;
    }
    return inner === undefined ? s + '/>' : s + '>' + inner + '</' + tag + '>';
  }
  const circ = (r, a) => el('circle', Object.assign({ r }, a));
  const dot = (p, r) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(r)}"/>`;

  // m marks per slice, mirror-symmetric about every slice's centre line.
  // shift is in units of one mark spacing (0 = centred on the petal, 0.5 = staggered).
  function marks(n, m, shift = 0) {
    const a = TAU / n, out = [];
    for (let s = 0; s < n; s++) for (let j = 0; j < m; j++) out.push({ a: s * a + (j - (m - 1) / 2 + shift) * a / m, j });
    return out;
  }
  // how many marks per slice fit at radius r without crowding closer than `gap` px
  const fit = (n, m, r, gap) => clamp(Math.min(m, Math.floor(TAU * r / (n * gap))), 1, m);

  function sector(r0, r1, a0, a1) {
    const lg = a1 - a0 > Math.PI ? 1 : 0;
    return `M${pt(polar(r1, a0))}A${f1(r1)} ${f1(r1)} 0 ${lg} 1 ${pt(polar(r1, a1))}` +
      `L${pt(polar(r0, a1))}A${f1(r0)} ${f1(r0)} 0 ${lg} 0 ${pt(polar(r0, a0))}Z`;
  }

  // ---------- petal shapes: half-width profile f(t), t = 0 at base .. 1 at tip ----------
  const SHAPES = {
    ovate:      { f: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.75), peak: 0.42 },
    elliptic:   { f: t => Math.pow(Math.sin(Math.PI * t), 0.55), peak: 0.5 },
    lanceolate: { f: t => Math.sin(Math.PI * Math.pow(t, 0.62)), peak: 0.33 },
    spatulate:  { f: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.9)), 0.5), peak: 0.69 },
    orbicular:  { f: t => Math.pow(Math.sin(Math.PI * t), 0.42), peak: 0.5 },
    cuneate:    { f: t => 0.45 + 0.55 * t, peak: 1, open: true },
    flabellate: { f: t => 0.12 + 0.88 * Math.pow(t, 0.65), peak: 1, open: true },
  };

  function resample(pts, M) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const S = cum[cum.length - 1], out = [];
    let k = 1;
    for (let i = 0; i <= M; i++) {
      const s = S * i / M;
      while (k < pts.length - 1 && cum[k] < s) k++;
      const t = (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
      out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]);
    }
    return { pts: out, S };
  }

  // Push points inward along the normal near the tip: notches, fringes, scallops, teeth.
  function applyEdge(pts, S, L, W, len) {
    if (L.edge === 'none') return pts;
    const E = L.E, M = pts.length - 1, s0 = S * (1 - E.zone);
    const depth = E.depth * Math.min(len, 3 * W);
    return pts.map((p, i) => {
      const s = S * i / M;
      if (s <= s0) return p;
      const u = (s - s0) / (S - s0);
      let d = 0;
      if (L.edge === 'notch') d = depth * Math.pow(u, 2.4);
      else if (L.edge === 'scallop') d = depth * (1 - Math.abs(Math.sin(Math.PI * u * E.teeth))) * smooth(0, 0.15, u);
      else { const ph = u * E.teeth, fr = ph - Math.floor(ph); d = depth * (1 - Math.abs(2 * fr - 1)) * smooth(0, 0.1, u); }
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(M, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [Math.max(0, p[0] + (b[1] - a[1]) / l * d), p[1] - (b[0] - a[0]) / l * d];
    });
  }

  function petalGeometry(L, n, rb, twist) {
    const half = Math.PI / n;
    const Rt = R * L.extent;
    const len = Rt - rb;
    const sh = SHAPES[L.shape];
    const peakR = rb + len * sh.peak;
    const W = Math.max(3, Math.min(peakR * Math.sin(Math.min(half, 1.4)) * L.width, len * (sh.open ? 0.7 : 0.6)));
    const N = 80;
    let right = [], side;

    if (!sh.open) {
      side = t => [W * sh.f(t), -(rb + len * t)];
      for (let i = 0; i <= N; i++) right.push(side(i / N));
      right[0][0] = 0; right[N][0] = 0;
    } else {
      const x1 = W * sh.f(1), cap = [];
      let top;
      if (L.cap === 'flat') {
        top = Math.sqrt(Rt * Rt - x1 * x1);
        const a0 = Math.asin(x1 / Rt);
        for (let i = 1; i <= 24; i++) { const a = a0 * (1 - i / 24); cap.push([Rt * Math.sin(a), -Rt * Math.cos(a)]); }
      } else {
        const h = Math.min(x1 * L.capH, len * 0.55);
        top = Rt - h;
        for (let i = 1; i <= 24; i++) {
          const u = i / 24;
          cap.push(L.cap === 'round'
            ? [x1 * Math.cos(u * Math.PI / 2), -(top + h * Math.sin(u * Math.PI / 2))]
            : [x1 * (1 - u), -(top + h * Math.pow(u, 0.8))]);
        }
      }
      side = t => [W * sh.f(t), -(rb + (top - rb) * t)];
      right.push([0, -rb]);
      for (let i = 0; i <= N; i++) right.push(side(i / N));
      right = right.concat(cap);
    }

    const rs = resample(right, 220);
    right = applyEdge(rs.pts, rs.S, L, W, len);
    right[right.length - 1][0] = 0;

    const tw = p => {
      if (!twist) return p;
      const t = clamp((Math.hypot(p[0], p[1]) - rb) / len, 0, 1);
      const a = twist * Math.min(2 * half, 0.5) * Math.pow(t, 1.4), c = Math.cos(a), s = Math.sin(a);
      return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
    };

    const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
    const outline = right.concat(left).map(tw);
    const tipR = -right[right.length - 1][1];
    const centre = [];
    for (let i = 0; i <= 20; i++) centre.push([0, -(tipR - (tipR - rb) * i / 20)]);
    const facet = right.map(tw).concat(centre.map(tw));

    return { d: poly(outline), outline, facet, W, rb, len, Rt, half, tw, side };
  }

  // ---------- design: every random decision lives here ----------
  function makePetalLayer(rng, col, role, main) {
    const shape = rng.weighted([['ovate', 3], ['elliptic', 2], ['lanceolate', 2], ['spatulate', 3], ['orbicular', 1.2], ['cuneate', 3], ['flabellate', 2]]);
    const open = !!SHAPES[shape].open;
    const cap = open ? rng.weighted([['flat', 3], ['round', 2], ['point', 1.5]]) : null;
    const rounded = ['spatulate', 'orbicular', 'elliptic'].includes(shape) || cap === 'flat' || cap === 'round';
    const edge = rng.weighted([['none', 5], ['notch', rounded ? 2.5 : 0], ['fringe', 2], ['scallop', rounded ? 1.5 : 0.4], ['serrate', 1]]);
    const E = {
      none: {},
      notch: { zone: rng.range(0.18, 0.3), depth: rng.range(0.1, 0.22) },
      fringe: { zone: rng.range(0.3, 0.55), depth: rng.range(0.04, 0.09), teeth: rng.int(4, 9) },
      scallop: { zone: rng.range(0.35, 0.6), depth: rng.range(0.035, 0.07), teeth: rng.int(2, 4) },
      serrate: { zone: 0.8, depth: rng.range(0.015, 0.03), teeth: rng.int(6, 12) },
    }[edge];
    const fill = rng.weighted([['solid', 2], ['facet', 2], ['gradient', 2.2], ['rays', 3], ['arcs', 2], ['veins', 2], ['outline', role === 'main' ? 1 : 0.3]]);

    let base, alt;
    if (role === 'main') { base = col.pA; alt = col.pB; } else {
      base = rng.pick([col.pB, col.ink, col.mB, mix(col.pA, col.ink, 0.35)].filter(c => c !== main.base));
      alt = rng.pick([col.pA, col.light, col.mA].filter(c => c !== base));
    }
    const gap = rng.range(3.5, 8);
    return {
      role, shape, cap, edge, E, fill, base, alt,
      capH: cap === 'point' ? rng.range(0.7, 1.6) : rng.range(0.45, 1),
      hatch: rng.pick([alt, col.ink, col.light].filter(c => c !== base)),
      width: role === 'main' ? (open ? rng.range(0.55, 1.05) : rng.range(0.7, 1.35)) : rng.range(0.8, 1.4),
      extent: role === 'main' ? 1 : rng.range(0.74, 0.96),
      rbF: rng.range(0.55, 0.9),
      gap, hatchW: Math.min(rng.range(0.6, 1.5), gap * 0.45), hatchAlt: rng.chance(0.5),
      veins: rng.int(3, 7),
      stroke: fill === 'outline' || rng.chance(0.3) ? rng.range(0.8, 1.6) : 0,
      overlapLine: rng.range(0.25, 0.5), // how dark the outline is when petals overlap
      gradFlip: rng.chance(0.35),
    };
  }

  const ZONE_TYPES = [['bands', 2], ['rays', 3], ['dots', 3], ['lace', 2], ['crown', 2], ['web', 1.4], ['florets', 2], ['mosaic', 1.5]];
  const ZONE_M = { bands: [1, 4], rays: [3, 14], dots: [1, 5], lace: [1, 4], crown: [1, 4], web: [1, 4], florets: [1, 4], mosaic: [1, 7] };

  function makeMiddle(rng, col) {
    const base = rng.weighted([[col.mA, 3], [col.light, 2], [col.mB, 2], [col.ink, 1]]);
    const others = [col.mA, col.mB, col.light, col.ink, col.pA, col.pB].filter(c => c !== base);
    const nz = rng.weighted([[1, 2], [2, 4], [3, 3]]);
    const w = Array.from({ length: nz }, () => rng.range(0.6, 1.4));
    const total = w.reduce((a, b) => a + b, 0);
    const zones = [];
    let acc = 0;
    for (let i = 0; i < nz; i++) {
      const type = rng.weighted(ZONE_TYPES);
      const c = rng.pick(others);
      zones.push({
        f0: acc / total, f1: (acc += w[i]) / total, type, c,
        c2: rng.pick(others.filter(x => x !== c)),
        m: rng.int(...ZONE_M[type]), k: rng.int(2, 5), sw: rng.range(0.7, 2.2),
        shift: rng.pick([0, 0, 0.5]), rows: rng.int(1, 3), size: rng.range(0.55, 0.95),
        sag: rng.range(0.88, 1.08), tips: rng.chance(0.5), alt: rng.chance(0.5), outline: rng.chance(0.4),
      });
    }
    return {
      base, zones, seps: rng.chance(0.55),
      rim: { w: rng.weighted([[0, 2], [1, 2], [2, 1], [5, 1], [9, 1]]), color: rng.chance(0.7) ? col.ink : rng.pick(others) },
    };
  }

  function makeCore(rng, col) {
    const a = rng.pick([col.cA, col.ink, col.pA]);
    return {
      type: rng.weighted([['bullseye', 3], ['stamens', 3], ['seed', 2], ['floret', 2]]),
      a, b: rng.pick([col.cB, col.light, col.mA].filter(c => c !== a)),
      k: rng.int(2, 5), m: rng.int(1, 4), ring: rng.chance(0.5),
    };
  }

  function makeDesign(seed) {
    const rng = makeRng(seed);
    const palette = rng.pick(PALETTES);
    const col = {
      pA: palette.petal[0], pB: palette.petal[1], mA: palette.mid[0], mB: palette.mid[1],
      cA: palette.core[0], cB: palette.core[1], ink: palette.ink, light: palette.light,
    };
    if (rng.chance(0.3)) [col.pA, col.pB] = [col.pB, col.pA];
    if (rng.chance(0.4)) [col.mA, col.mB] = [col.mB, col.mA];

    const r1 = R * rng.range(0.11, 0.24);
    const r2 = R * rng.range(Math.max(0.36, r1 / R + 0.17), 0.6);
    const twist = rng.chance(0.14) ? rng.range(0.12, 0.35) * rng.pick([-1, 1]) : 0;
    const main = makePetalLayer(rng, col, 'main');
    const back = rng.chance(0.5) ? makePetalLayer(rng, col, 'back', main) : null;
    return { seed, palette, col, r1, r2, twist, main, back, middle: makeMiddle(rng, col), core: makeCore(rng, col) };
  }

  // ---------- rendering ----------
  function renderPetalLayer(L, id, n, d, rb, offset, defs) {
    id = d.uid + id;
    const g = petalGeometry(L, n, rb, d.twist);
    const col = d.col, parts = [];
    let fill = L.base;

    if (L.fill === 'gradient' || L.fill === 'veins') {
      const inner = L.fill === 'veins' ? mix(L.base, col.light, 0.45) : (L.gradFlip ? L.base : L.alt);
      const outer = L.fill === 'veins' ? L.base : (L.gradFlip ? L.alt : L.base);
      defs.push(`<radialGradient id="grad-${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${f1(g.Rt)}">` +
        `<stop offset="${(rb / g.Rt).toFixed(3)}" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient>`);
      fill = `url(#grad-${id})`;
    }
    if (L.fill === 'outline') fill = mix(L.base, col.light, 0.82);
    parts.push(el('path', { d: g.d, fill }));
    if (L.fill === 'facet') parts.push(el('path', { d: poly(g.facet), fill: L.alt }));

    // texture, clipped to the petal
    let tex = '';
    const span = Math.max(...g.outline.map(([x, y]) => Math.abs(Math.atan2(x, -y)))) + 0.01;
    if (L.fill === 'rays') {
      const da = L.gap / g.Rt, K = Math.min(160, Math.ceil(span / da));
      let p = '';
      for (let k = -K; k <= K; k++) p += `M${pt(polar(rb * 0.8, k * da))}L${pt(polar(g.Rt + 30, k * da))}`;
      tex = el('path', { d: p, fill: 'none', stroke: L.hatch, 'stroke-width': L.hatchW.toFixed(2) });
    } else if (L.fill === 'arcs') {
      let pa = '', pb = '', i = 0;
      const lg = span * 2 > Math.PI ? 1 : 0;
      for (let r = rb + L.gap / 2; r < g.Rt + L.gap; r += L.gap, i++) {
        const seg = `M${pt(polar(r, -span))}A${f1(r)} ${f1(r)} 0 ${lg} 1 ${pt(polar(r, span))}`;
        if (L.hatchAlt && i % 2) pb += seg; else pa += seg;
      }
      tex = el('path', { d: pa, fill: 'none', stroke: L.hatch, 'stroke-width': L.hatchW.toFixed(2) }) +
        (pb ? el('path', { d: pb, fill: 'none', stroke: L.hatch, 'stroke-width': Math.min(L.hatchW * 2.2, L.gap * 0.7).toFixed(2) }) : '');
    } else if (L.fill === 'veins') {
      const mid = [];
      for (let i = 0; i <= 20; i++) mid.push(g.tw([0, -(rb + g.len * 0.97 * i / 20)]));
      let p = poly(mid, false);
      for (let k = 1; k <= L.veins; k++) {
        const t = 0.1 + 0.78 * k / (L.veins + 1), t2 = Math.min(0.98, t + 0.16);
        const s = [0, -(rb + g.len * t)], e = g.side(t2);
        e[0] *= 0.88;
        const c = [e[0] * 0.6, s[1] + (e[1] - s[1]) * 0.2];
        for (const sg of [1, -1]) {
          const S = g.tw(s), C = g.tw([c[0] * sg, c[1]]), Ep = g.tw([e[0] * sg, e[1]]);
          p += `M${pt(S)}Q${pt(C)} ${pt(Ep)}`;
        }
      }
      tex = el('path', { d: p, fill: 'none', stroke: mix(L.base, col.ink, 0.5), 'stroke-width': '1', 'stroke-linecap': 'round' });
    } else if (L.fill === 'outline') {
      const c = g.tw([0, -(rb + g.len * 0.55)]);
      const inner = g.outline.map(([x, y]) => [c[0] + (x - c[0]) * 0.7, c[1] + (y - c[1]) * 0.7]);
      const mid = [];
      for (let i = 0; i <= 12; i++) mid.push(g.tw([0, -(rb + g.len * (0.12 + 0.72 * i / 12))]));
      tex = el('path', { d: poly(inner) + poly(mid, false), fill: 'none', stroke: L.base, 'stroke-width': '1' });
    }
    if (tex) {
      defs.push(`<clipPath id="clip-${id}"><path d="${g.d}"/></clipPath>`);
      parts.push(`<g clip-path="url(#clip-${id})">${tex}</g>`);
    }
    // overlapping petals of one flat colour would merge into a blob, so give them an edge
    const overlaps = span > g.half * 0.98;
    if (L.stroke || overlaps) {
      parts.push(el('path', {
        d: g.d, fill: 'none',
        stroke: L.fill === 'outline' ? L.base : L.stroke ? col.ink : mix(L.base, col.ink, L.overlapLine),
        'stroke-width': (L.fill === 'outline' ? 1.6 : L.stroke || 1.1).toFixed(2), 'stroke-linejoin': 'round',
      }));
    }
    defs.push(`<g id="pu-${id}">${parts.join('')}</g>`);

    // Seam: petal k is drawn over petal k-1, so petal 0 must be re-drawn over petal n-1
    // (its left half only) for the overlap to look the same all the way around.
    const seam = [[0, 60]];
    for (let i = 0; i <= 24; i++) seam.push(g.tw([0, -(R + 80) * i / 24]));
    const last = seam[seam.length - 1];
    seam.push([last[0], -HALF - 200], [-HALF - 200, -HALF - 200], [-HALF - 200, 60]);
    defs.push(`<clipPath id="seam-${id}"><path d="${poly(seam)}"/></clipPath>`);

    const alpha = TAU / n;
    let out = '';
    for (let s = 0; s < n; s++) out += `<use xlink:href="#pu-${id}" transform="rotate(${toDeg(s * alpha + offset)})"/>`;
    out += `<g transform="rotate(${toDeg(offset)})"><g clip-path="url(#seam-${id})"><use xlink:href="#pu-${id}"/></g></g>`;
    return `<g class="petals-${id}">${out}</g>`;
  }

  // Middle-ring zone painters. Each gets the zone spec, its radii a..b, fold count, colours.
  const ZONES = {
    bands(z, a, b, n, col, base) {
      const cols = [z.c, z.c2 === z.c ? base : z.c2];
      let s = '';
      for (let i = 0; i < z.k; i++) {
        s += circ(b - (b - a) * i / z.k, { fill: cols[i % 2], stroke: z.outline ? col.ink : null, 'stroke-width': z.outline ? '0.8' : null });
      }
      if (z.tips) { // a dashed ring with one dash per mark, centred on the petals
        const r = (a + b) / 2, P = TAU * r / (n * Math.max(1, z.m));
        s += circ(r, {
          fill: 'none', stroke: col.ink, 'stroke-width': Math.min(4, (b - a) / z.k * 0.6).toFixed(2),
          'stroke-dasharray': `${f1(P / 2)} ${f1(P / 2)}`, 'stroke-dashoffset': f1(P / 4), transform: 'rotate(-90)',
        });
      }
      return s;
    },
    rays(z, a, b, n) {
      const m = z.alt ? odd(fit(n, z.m, a + 2, 3)) : fit(n, z.m, a + 2, 3);
      const pad = (b - a) * 0.08;
      let p = '', tips = '';
      for (const { a: t, j } of marks(n, m, z.alt ? 0 : z.shift)) {
        const end = z.alt && j % 2 ? (a + b) / 2 : b - pad;
        p += `M${pt(polar(a + pad, t))}L${pt(polar(end, t))}`;
        if (z.tips) tips += dot(polar(end, t), Math.max(1.2, z.sw * 1.3));
      }
      return el('path', { d: p, fill: 'none', stroke: z.c, 'stroke-width': z.sw.toFixed(2), 'stroke-linecap': 'round' }) +
        (tips ? `<g fill="${z.c}">${tips}</g>` : '');
    },
    dots(z, a, b, n, col) {
      const h = (b - a) / z.rows;
      let s = '';
      for (let i = 0; i < z.rows; i++) {
        const r = a + h * (i + 0.5), m = fit(n, z.m, r, 6);
        const rad = Math.max(1.2, Math.min(TAU * r / (n * m) * 0.42, h * 0.42) * z.size);
        let row = '';
        for (const { a: t } of marks(n, m, z.shift + (z.alt ? (i % 2) * 0.5 : 0))) row += dot(polar(r, t), rad);
        s += `<g fill="${i % 2 ? z.c2 : z.c}"${z.outline ? ` stroke="${col.ink}" stroke-width="0.8"` : ''}>${row}</g>`;
      }
      return s;
    },
    lace(z, a, b, n, col) {
      const r = (a + b) / 2, m = fit(n, z.m, r, 10);
      const rad = Math.min(TAU * r / (n * m) * 0.62, (b - a) * 0.55);
      const ms = marks(n, m, z.shift);
      let c = '', inner = '';
      for (const { a: t } of ms) { c += dot(polar(r, t), rad); if (z.tips) inner += dot(polar(r, t), rad * 0.4); }
      // fills first, then every outline on top, so the interlocking rings look the same at every seam
      return `<g fill="${z.c}">${c}</g><g fill="none" stroke="${col.ink}" stroke-width="0.9">${c}</g>` +
        (inner ? `<g fill="${z.c2}">${inner}</g>` : '');
    },
    crown(z, a, b, n, col, base) {
      const m = fit(n, z.m, b, 8), step = TAU / (n * m), ri = a + (b - a) * (1 - z.size) * 0.5;
      const pts = [];
      for (const { a: t } of marks(n, m, z.shift)) pts.push(polar(b, t), polar(ri, t + step / 2));
      return el('path', { d: poly(pts), fill: z.c, stroke: z.outline ? col.ink : null, 'stroke-width': z.outline ? '0.9' : null, 'stroke-linejoin': 'round' }) +
        circ(a, { fill: base });
    },
    web(z, a, b, n, col) {
      const m = fit(n, z.m, a + 5, 7), step = TAU / (n * m), ms = marks(n, m, z.shift);
      let p = '', dots = '';
      for (const { a: t } of ms) p += `M${pt(polar(a, t))}L${pt(polar(b, t))}`;
      for (let i = 1; i <= z.k; i++) {
        const r = a + (b - a) * i / (z.k + 1), cr = r * Math.cos(step / 2) * z.sag;
        for (const { a: t } of ms) {
          p += `M${pt(polar(r, t))}Q${pt(polar(cr, t + step / 2))} ${pt(polar(r, t + step))}`;
          if (z.tips && i === z.k) dots += dot(polar(r, t), 2.2);
        }
      }
      return el('path', { d: p, fill: 'none', stroke: z.c, 'stroke-width': Math.min(z.sw, 1.2).toFixed(2) }) +
        (dots ? `<g fill="${col.ink}">${dots}</g>` : '');
    },
    florets(z, a, b, n, col) {
      const r = (a + b) / 2, m = fit(n, z.m, r, 9);
      const rx = Math.max(1.5, TAU * r / (n * m) * 0.36 * z.size), ry = (b - a) * 0.44;
      let s = '', tips = '';
      for (const { a: t } of marks(n, m, z.shift)) {
        s += `<ellipse cx="0" cy="${f1(-r)}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(${toDeg(t)})"/>`;
        if (z.tips) tips += dot(polar(r - ry * 0.55, t), Math.max(1, rx * 0.45));
      }
      return `<g fill="${z.c}"${z.outline ? ` stroke="${col.ink}" stroke-width="0.8"` : ''}>${s}</g>` +
        (tips ? `<g fill="${z.c2}">${tips}</g>` : '');
    },
    mosaic(z, a, b, n) {
      const m = odd(fit(n, z.m, a + 4, 8)), step = TAU / (n * m), k = Math.min(z.k, 3);
      let p = '';
      for (let i = 0; i < k; i++) {
        const r0 = a + (b - a) * i / k, r1 = a + (b - a) * (i + 1) / k;
        for (const { a: t, j } of marks(n, m, 0)) if ((i + j) % 2 === 0) p += sector(r0, r1, t - step / 2, t + step / 2);
      }
      return el('path', { d: p, fill: z.c });
    },
  };

  function renderMiddle(d, n) {
    const M = d.middle, col = d.col, span = d.r2 - d.r1;
    let s = circ(d.r2, { fill: M.base });
    for (const z of M.zones.slice().reverse()) s += ZONES[z.type](z, d.r1 + span * z.f0, d.r1 + span * z.f1, n, col, M.base);
    if (M.seps) for (const z of M.zones.slice(1)) s += circ(d.r1 + span * z.f0, { fill: 'none', stroke: col.ink, 'stroke-width': '0.8' });
    if (M.rim.w) s += circ(d.r2 - M.rim.w / 2, { fill: 'none', stroke: M.rim.color, 'stroke-width': M.rim.w });
    return s;
  }

  function renderCore(d, n) {
    const C = d.core, r = d.r1, col = d.col;
    let s = '';
    if (C.type === 'bullseye') {
      for (let i = 0; i < C.k; i++) s += circ(r * (1 - i / C.k), { fill: i % 2 ? C.b : C.a });
      s += circ(Math.max(2.5, r * 0.08), { fill: C.k % 2 ? C.b : C.a });
    } else if (C.type === 'stamens') {
      const m = fit(n, C.m * 2, r * 0.86, 5), sp = TAU * r * 0.86 / (n * m);
      let p = '', tips = '';
      for (const { a: t } of marks(n, m)) {
        p += `M${pt(polar(r * 0.22, t))}L${pt(polar(r * 0.84, t))}`;
        tips += dot(polar(r * 0.86, t), clamp(sp * 0.35, 1.2, 3));
      }
      s += circ(r, { fill: C.b }) + el('path', { d: p, stroke: C.a, 'stroke-width': '0.8', fill: 'none' }) +
        `<g fill="${C.a}">${tips}</g>` + circ(r * 0.2, { fill: C.a });
    } else if (C.type === 'seed') {
      const m = fit(n, C.m, r * 0.62, 6), sp = TAU * r * 0.62 / (n * m);
      let ring = '';
      for (const { a: t } of marks(n, m, 0.5)) ring += dot(polar(r * 0.62, t), clamp(sp * 0.3, 1, r * 0.14));
      s += circ(r, { fill: C.a }) + `<g fill="${C.b}">${ring}</g>` + circ(r * 0.18, { fill: C.b });
    } else {
      const m = fit(n, C.m, r * 0.55, 6), rx = Math.max(1.2, TAU * r * 0.55 / (n * m) * 0.38);
      let e = '';
      for (const { a: t } of marks(n, m)) e += `<ellipse cx="0" cy="${f1(-r * 0.55)}" rx="${f1(rx)}" ry="${f1(r * 0.36)}" transform="rotate(${toDeg(t)})"/>`;
      s += circ(r, { fill: C.b }) + `<g fill="${C.a}">${e}</g>` + circ(r * 0.2, { fill: C.a }) + circ(r * 0.08, { fill: C.b });
    }
    if (C.ring) s += circ(r, { fill: 'none', stroke: col.ink, 'stroke-width': '1.2' });
    return s;
  }

  // The concentric ring grid: three rings + the fold lines, with one slice highlighted.
  function renderGrid(d, n) {
    const alpha = TAU / n, ext = R + 46;
    let p = '';
    for (let s = 0; s < n; s++) { const t = s * alpha + alpha / 2; p += `M0 0L${pt(polar(ext, t))}`; }
    const unit = `M0 0L${pt(polar(ext, -alpha / 2))}A${ext} ${ext} 0 0 1 ${pt(polar(ext, alpha / 2))}Z`;
    const rings = [[d.r1, 'I  core'], [d.r2, 'II  middle'], [R, 'III  petal']];
    let labels = '';
    for (const [r, label] of rings) {
      const [x, y] = polar(r, Math.PI * 0.75);
      labels += `<text x="${f1(x + 10)}" y="${f1(y + 6)}">${label}</text>`;
    }
    const lines = `<path d="${p}"/>${rings.map(([r]) => circ(r, {})).join('')}`;
    const ink = '#16130f', halo = '#f6efe6';
    return `<g class="grid" pointer-events="none">` +
      `<path d="${unit}" fill="${halo}" fill-opacity="0.22" stroke="${ink}" stroke-opacity="0.5" stroke-width="1.2"/>` +
      `<g fill="none" stroke="${halo}" stroke-opacity="0.75" stroke-width="3.2">${lines}</g>` +
      `<g fill="none" stroke="${ink}" stroke-opacity="0.85" stroke-width="1.1" stroke-dasharray="3 4">${lines}</g>` +
      `<g font-family="'EB Garamond', Georgia, serif" font-size="22" font-style="italic" fill="${ink}" ` +
      `stroke="${halo}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${labels}</g></g>`;
  }

  let renderCount = 0;
  function renderSVG(d, n, opts = {}) {
    // ids are namespaced per render so several flowers can share one document
    const u = d.uid = 'f' + (renderCount++).toString(36) + '-';
    const defs = [
      `<filter id="${u}mottle" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="4" seed="3"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0.9 -0.36"/></filter>`,
      `<filter id="${u}grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 1.3 -0.55"/></filter>`,
    ];
    const rb = d.r2 * d.main.rbF;
    let flower = '';
    if (d.back) flower += renderPetalLayer(d.back, 'back', n, d, rb * 0.92, Math.PI / n, defs);
    flower += renderPetalLayer(d.main, 'main', n, d, rb, 0, defs);
    flower += `<g class="middle">${renderMiddle(d, n)}</g><g class="core">${renderCore(d, n)}</g>`;

    const tile = `x="${-HALF}" y="${-HALF}" width="${HALF * 2}" height="${HALF * 2}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}">` +
      `<defs>${defs.join('')}</defs>` +
      `<rect ${tile} fill="#ebdccc"/><rect ${tile} filter="url(#${u}mottle)" opacity="0.8"/>` +
      `<g class="flower">${flower}</g>` +
      `<rect ${tile} filter="url(#${u}grain)" opacity="0.45" style="mix-blend-mode:multiply"/>` +
      (opts.grid ? renderGrid(d, n) : '') +
      `</svg>`;
  }

  // ---------- a plain-language recipe for the caption ----------
  const SHAPE_NAMES = { ovate: 'Ovate', elliptic: 'Elliptic', lanceolate: 'Lanceolate', spatulate: 'Spatulate', orbicular: 'Orbicular', cuneate: 'Wedge', flabellate: 'Fan' };
  const EDGE_NAMES = { notch: 'notched', fringe: 'fringed', scallop: 'scalloped', serrate: 'serrated' };
  const FILL_NAMES = { solid: 'solid', facet: 'two-tone fold', gradient: 'washed', rays: 'ray-hatched', arcs: 'banded', veins: 'veined', outline: 'line-drawn' };
  const ZONE_NAMES = { bands: 'banded rings', rays: 'radiating lines', dots: 'beads', lace: 'lace', crown: 'crown', web: 'web', florets: 'florets', mosaic: 'mosaic' };
  const CORE_NAMES = { bullseye: 'Bullseye', stamens: 'Stamens', seed: 'Seed head', floret: 'Floret' };
  const listJoin = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1]);

  function describe(d) {
    const L = d.main;
    let petal = SHAPE_NAMES[L.shape] + (L.edge !== 'none' ? ', ' + EDGE_NAMES[L.edge] : '') + ' · ' + FILL_NAMES[L.fill];
    if (d.twist) petal += ' · pinwheeled';
    if (d.back) petal += ' · second whorl behind';
    const zones = [...new Set(d.middle.zones.map(z => ZONE_NAMES[z.type]))];
    const middle = listJoin(zones).replace(/^./, c => c.toUpperCase());
    return { petal, middle, core: CORE_NAMES[d.core.type], palette: d.palette.name };
  }

  global.Flora = { makeDesign, renderSVG, describe, randomSeed, PALETTES };
})(window);
