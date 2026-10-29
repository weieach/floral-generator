/* Floral Generator — "Painterly" style (style key: paint).
 *
 * After the painted bouquets in visual-ref/D-painterly: saturated petals worked with visible
 * brush strokes (fine hatching, dabs, streaks or speckles), wet blotches of a second colour,
 * ragged painted edges, leaves on a black felt ground, and watercolour-paper grain.
 *
 * Petal geometry and strokes repeat exactly in every fold (the strokes are mirrored within a
 * petal); the blotches and ragged edges come from noise in tile space, so each petal is
 * painted a little differently, as by hand.
 */
(function (global) {
  'use strict';

  const U = global.Flora.util;
  const { TAU, R, HALF, makeRng, hashSeed, mix, f1, pt, polar, toDeg, el, circ, dot, marks, fit, SHAPES, petalGeometry, renderGrid } = U;

  const INK = '#1a1410';
  // Sampled from the two bouquets.
  const FLOWERS = [
    { name: 'Cobalt pansy',  base: '#2b30a0', blotch: '#5a2fb4', light: '#8c9cf0', dark: '#161a5c' },
    { name: 'Crimson poppy', base: '#c4142c', blotch: '#ec5d82', light: '#ff9a9a', dark: '#5c0614' },
    { name: 'Golden poppy',  base: '#f6c31c', blotch: '#f2741c', light: '#ffe98a', dark: '#b8760c' },
    { name: 'Peony pink',    base: '#f0a6bf', blotch: '#de4a7e', light: '#fff1f5', dark: '#a8335c' },
    { name: 'Zinnia orange', base: '#f2621e', blotch: '#d8301c', light: '#ffae66', dark: '#8c2410' },
    { name: 'Sky aster',     base: '#2f90e2', blotch: '#1a5cc2', light: '#9ad6ff', dark: '#123c82' },
    { name: 'Teal anemone',  base: '#2a9a98', blotch: '#1c6c78', light: '#86dcd0', dark: '#0f4a50' },
    { name: 'White anemone', base: '#f3f0e4', blotch: '#ecc3cf', light: '#ffffff', dark: '#9c9684' },
    { name: 'Magenta',       base: '#d61a7f', blotch: '#f24c9c', light: '#ffa0d0', dark: '#6a0c3c' },
    { name: 'Sunflower',     base: '#f2aa1e', blotch: '#e06e1a', light: '#ffd870', dark: '#a85c0c' },
  ];
  // The ground is always black; only the leaf greens vary.
  const BLACK = '#0b0b0a';
  const GROUNDS = [
    { name: 'black, forest leaves', bg: BLACK, leaf: ['#3f7a34', '#6fa443', '#a3c45a'] },
    { name: 'black, moss leaves',   bg: BLACK, leaf: ['#2f6b35', '#5c9a3e', '#9cc45a'] },
    { name: 'black, pine leaves',   bg: BLACK, leaf: ['#3a7040', '#7aa84a', '#b5cf6a'] },
    { name: 'black, sage leaves',   bg: BLACK, leaf: ['#4d7a5a', '#7fa07a', '#b4c8a0'] },
  ];
  const POLLEN = { disc: '#f3c11c', deep: '#d0820e', seed: '#5a3815', seedDot: '#c9a53c', anther: '#f2c43a' };
  const STROKES = {
    hatch:   { count: 150, len: [18, 46], w: [0.8, 1.6], a: [0.45, 0.85] }, // fine radial hatching
    dab:     { count: 80, len: [6, 14], w: [3, 6], a: [0.4, 0.7] },         // short impressionist dabs
    streak:  { count: 45, len: [40, 95], w: [1.5, 3], a: [0.35, 0.65] },    // long streaks from the base
    speckle: { count: 70, len: [0, 0], w: [2, 4.5], a: [0.5, 0.85] },       // spots, like a speckled petunia
  };

  // ---------- design ----------
  function makeLayer(rng, F, role) {
    const shape = rng.weighted([['orbicular', 2.5], ['spatulate', 2.5], ['ovate', 2], ['elliptic', 1.5], ['flabellate', 1.2], ['lanceolate', 0.8]]);
    const rounded = shape !== 'lanceolate' && shape !== 'ovate';
    const edge = rng.weighted([['none', 4], ['notch', rounded ? 1.2 : 0], ['scallop', 0.8], ['fringe', 0.3]]);
    const E = {
      none: {},
      notch: { zone: rng.range(0.15, 0.25), depth: rng.range(0.06, 0.14) },
      scallop: { zone: rng.range(0.3, 0.5), depth: rng.range(0.025, 0.05), teeth: rng.int(2, 3) },
      fringe: { zone: rng.range(0.25, 0.4), depth: rng.range(0.04, 0.07), teeth: rng.int(4, 8) },
    }[edge];
    const style = rng.weighted([['hatch', 3], ['dab', 2], ['streak', 2], ['speckle', 1]]);
    const S = STROKES[style];
    // strokes in petal coordinates (t along the petal, q across one half); mirrored when drawn
    const strokes = Array.from({ length: S.count }, () => ({
      t: style === 'streak' ? rng.range(0.08, 0.55) : rng.range(0.08, 0.95), q: Math.pow(rng.range(0, 1), 0.8),
      len: rng.range(...S.len), w: rng.range(...S.w), a: rng.range(...S.a), light: rng.chance(0.6),
    }));
    return {
      role, F, shape, edge, E, style, strokes,
      cap: shape === 'flabellate' ? 'round' : null, capH: rng.range(0.6, 0.9),
      width: role === 'back' ? rng.range(0.9, 1.3) : rng.range(1, 1.45),
      extent: role === 'back' ? rng.range(0.85, 1) : 1,
      rbF: rng.range(0.2, 0.6),
      blotch: rng.range(0.35, 0.7),
    };
  }

  function makeDesign(seed) {
    const rng = makeRng(seed);
    const F = rng.pick(FLOWERS);
    const F2 = rng.pick(FLOWERS.filter(f => f !== F));
    const G = rng.pick(GROUNDS);
    const r1 = R * rng.range(0.09, 0.17);
    const r2 = R * rng.range(Math.max(0.22, r1 / R + 0.08), 0.4);
    const main = makeLayer(rng, F, 'main');
    const back = rng.chance(0.45) ? makeLayer(rng, rng.chance(0.5) ? F : F2, 'back') : null;
    const inner = rng.chance(0.4) ? makeLayer(rng, F2, 'inner') : null;
    return {
      seed, F, F2, G, r1, r2, main, back, inner,
      noise: hashSeed(String(seed)) % 997,
      leaves: rng.chance(0.65) ? {
        shape: rng.pick(['lanceolate', 'ovate', 'elliptic']), width: rng.range(0.45, 0.8),
        extent: rng.range(1.04, 1.14), m: rng.pick([1, 1, 2]), colour: rng.pick(G.leaf.slice(0, 2)),
      } : null,
      eye: { colour: rng.chance(0.6) ? F.dark : F2.base, strength: rng.range(0.5, 0.85) },
      centre: { type: rng.weighted([['pollen', 3], ['stamens', 3], ['seedhead', 1.5], ['eye', 1.5]]), m: rng.int(2, 4) },
      outline: rng.chance(0.6),
    };
  }

  // ---------- filters ----------
  // ragged painted edge (identical for a layer's paint and its strokes, so they stay registered)
  const rag = seed =>
    `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}" result="w"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="w" scale="7" xChannelSelector="R" yChannelSelector="G" result="shape"/>`;

  function paintFilter(id, seed, blotchColour, amount) {
    return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">` + rag(seed) +
      // wet-in-wet blotches of a second colour, soft-edged where they bleed
      `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="${seed + 1}" result="n"/>` +
      `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  7 0 0 0 -3.3" result="m"/>` +
      `<feGaussianBlur in="m" stdDeviation="2.5" result="mb"/>` +
      `<feFlood flood-color="${blotchColour}" flood-opacity="${amount.toFixed(2)}"/>` +
      `<feComposite in2="mb" operator="in" result="bl"/><feComposite in="bl" in2="shape" operator="in" result="bl2"/>` +
      `<feMerge><feMergeNode in="shape"/><feMergeNode in="bl2"/></feMerge></filter>`;
  }
  const ragFilter = (id, seed) => `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">${rag(seed)}</filter>`;

  // ---------- rendering ----------
  // One painted whorl: a fill group (paint + blotches) and a stroke group (brushwork), both
  // ragged with the same noise so the strokes sit exactly on the paint.
  function renderLayer(L, id, n, d, rb, offset, extent, defs) {
    const F = L.F;
    const g = petalGeometry(Object.assign({}, L, { extent }), n, rb, 0);
    const sh = SHAPES[L.shape], seed = d.noise + { back: 11, main: 23, inner: 37 }[L.role]; // each whorl its own noise
    defs.push(`<clipPath id="${id}-clip"><path d="${g.d}"/></clipPath>`);
    defs.push(paintFilter(`${id}-paint`, seed, F.blotch, L.blotch), ragFilter(`${id}-rag`, seed));

    // the dark eye bleeds out from the centre to ring II
    let fill = el('path', { d: g.d, fill: F.base });
    // shading across the petal, darker toward its sides, so overlapping petals stay distinct
    defs.push(`<linearGradient id="${id}-form" gradientUnits="userSpaceOnUse" x1="${f1(-g.W)}" y1="0" x2="${f1(g.W)}" y2="0">` +
      `<stop offset="0" stop-color="${F.dark}" stop-opacity="0.45"/><stop offset="0.3" stop-color="${F.dark}" stop-opacity="0.08"/>` +
      `<stop offset="0.5" stop-color="${F.light}" stop-opacity="0.12"/><stop offset="0.7" stop-color="${F.dark}" stop-opacity="0.08"/>` +
      `<stop offset="1" stop-color="${F.dark}" stop-opacity="0.45"/></linearGradient>`);
    fill += el('path', { d: g.d, fill: `url(#${id}-form)` });
    if (L.role !== 'inner') {
      const E = d.eye, er = d.r2 * 1.15;
      defs.push(`<radialGradient id="${id}-eye" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${f1(er)}">` +
        `<stop offset="0" stop-color="${E.colour}" stop-opacity="${E.strength.toFixed(2)}"/>` +
        `<stop offset="0.55" stop-color="${E.colour}" stop-opacity="${(E.strength * 0.55).toFixed(2)}"/>` +
        `<stop offset="1" stop-color="${E.colour}" stop-opacity="0"/></radialGradient>`);
      fill += el('path', { d: g.d, fill: `url(#${id}-eye)` });
    }
    defs.push(`<g id="${id}-fill">${fill}</g>`);

    // brushwork: strokes radiate from the flower's centre, mirrored across the petal
    let light = '', dark = '';
    for (const s of L.strokes) {
      const t = s.t, x = s.q * g.W * sh.f(Math.min(t, 0.98)), y = -(rb + g.len * t);
      for (const sx of [1, -1]) {
        const px = x * sx, l = Math.hypot(px, y) || 1, dx = px / l * s.len / 2, dy = y / l * s.len / 2;
        const seg = L.style === 'speckle'
          ? `M${f1(px)} ${f1(y)}l0.01 0`
          : `M${f1(px - dx)} ${f1(y - dy)}L${f1(px + dx)} ${f1(y + dy)}`;
        if (s.light) light += seg; else dark += seg;
      }
    }
    const avgW = L.strokes.reduce((a, s) => a + s.w, 0) / L.strokes.length;
    const avgA = L.strokes.reduce((a, s) => a + s.a, 0) / L.strokes.length;
    let strokes = `<g fill="none" stroke-linecap="round" stroke-width="${f1(avgW)}" stroke-opacity="${Math.min(0.95, avgA + 0.12).toFixed(2)}">` +
      el('path', { d: light, stroke: F.light }) + el('path', { d: dark, stroke: mix(F.base, F.dark, 0.6) }) + `</g>`;
    if (d.outline) strokes += el('path', { d: g.d, fill: 'none', stroke: mix(F.base, INK, 0.55), 'stroke-width': '1.6', 'stroke-opacity': '0.75' });
    defs.push(`<g id="${id}-strokes"><g clip-path="url(#${id}-clip)">${strokes}</g></g>`);

    let fills = '', brush = '';
    for (let s = 0; s < n; s++) {
      const rot = `transform="rotate(${toDeg(s * TAU / n + offset)})"`;
      fills += `<use xlink:href="#${id}-fill" ${rot}/>`;
      brush += `<use xlink:href="#${id}-strokes" ${rot}/>`;
    }
    return `<g filter="url(#${id}-paint)">${fills}</g><g filter="url(#${id}-rag)">${brush}</g>`;
  }

  function renderLeaves(d, n, defs) {
    const Lf = d.leaves, G = d.G, u = d.u, id = u + 'leaf';
    const L = { shape: Lf.shape, width: Lf.width, extent: Lf.extent, edge: 'none', E: {} };
    const g = petalGeometry(L, n, d.r2 * 0.8, 0);
    const vein = mix(Lf.colour, G.leaf[2], 0.6);
    let veins = `M0 ${f1(-g.rb)}L0 ${f1(-g.Rt * 0.97)}`;
    for (let k = 1; k <= 5; k++) {
      const t = k / 6, y = -(g.rb + g.len * t), x = g.W * SHAPES[L.shape].f(Math.min(0.98, t + 0.12)) * 0.8;
      veins += `M0 ${f1(y)}Q${f1(x * 0.5)} ${f1(y - g.len * 0.05)} ${f1(x)} ${f1(y - g.len * 0.12)}` +
        `M0 ${f1(y)}Q${f1(-x * 0.5)} ${f1(y - g.len * 0.05)} ${f1(-x)} ${f1(y - g.len * 0.12)}`;
    }
    defs.push(paintFilter(`${id}-paint`, d.noise + 60, G.leaf[2], 0.35));
    defs.push(`<g id="${id}"><path d="${g.d}" fill="${Lf.colour}"/>` +
      `<path d="${veins}" fill="none" stroke="${vein}" stroke-width="1.6" stroke-opacity="0.7" stroke-linecap="round"/></g>`);
    let uses = '';
    for (const { a } of marks(n, Lf.m, 0.5)) uses += `<use xlink:href="#${id}" transform="rotate(${toDeg(a)})"/>`;
    return `<g filter="url(#${id}-paint)">${uses}</g>`;
  }

  function renderCentre(d, n) {
    const C = d.centre, r = d.r1, u = d.u;
    let s = '';
    if (C.type === 'pollen') {
      // a soft pollen disc, stippled with deeper dots
      let dots = '';
      for (const [rr, m] of [[0.35, C.m], [0.68, C.m * 2]]) {
        const k = fit(n, m, r * rr, 6);
        for (const { a } of marks(n, k, rr > 0.5 ? 0.5 : 0)) dots += dot(polar(r * rr, a), Math.max(1.2, r * 0.07));
      }
      s += circ(r, { fill: POLLEN.disc, filter: `url(#${u}soft)` }) + `<g fill="${POLLEN.deep}" fill-opacity="0.8">${dots}</g>`;
    } else if (C.type === 'stamens') {
      // a dark eye with filaments ending in pollen-laden anthers
      const k = fit(n, C.m + 1, r * 1.1, 9);
      let fil = '', anth = '';
      for (const { a } of marks(n, k)) {
        fil += `M${pt(polar(r * 0.25, a))}L${pt(polar(r * 1.05, a))}`;
        const [x, y] = polar(r * 1.12, a);
        anth += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(Math.max(2, r * 0.07))}" ry="${f1(Math.max(3, r * 0.12))}" transform="rotate(${toDeg(a)} ${f1(x)} ${f1(y)})"/>`;
      }
      s += circ(r * 0.62, { fill: d.F.dark, filter: `url(#${u}soft)` }) +
        el('path', { d: fil, stroke: mix(d.F.dark, INK, 0.3), 'stroke-width': '1.4', fill: 'none' }) +
        `<g fill="${POLLEN.anther}">${anth}</g>`;
    } else if (C.type === 'seedhead') {
      // a sunflower-like seed head: rings of dots on a brown disc
      let dots = '';
      for (let i = 1; i <= 4; i++) {
        const rr = r * i / 4.6, k = fit(n, C.m * i, rr, 6);
        for (const { a } of marks(n, k, i % 2 ? 0 : 0.5)) dots += dot(polar(rr, a), Math.max(1.2, r * 0.06));
      }
      s += circ(r, { fill: POLLEN.seed, filter: `url(#${u}soft)` }) + `<g fill="${POLLEN.seedDot}">${dots}</g>`;
    } else {
      // a dark eye ringed with pale dots
      const k = fit(n, C.m, r * 0.7, 7);
      let dots = '';
      for (const { a } of marks(n, k, 0.5)) dots += dot(polar(r * 0.7, a), Math.max(1.5, r * 0.09));
      s += circ(r * 0.9, { fill: d.F.dark, filter: `url(#${u}soft)` }) + `<g fill="${d.F.light}" fill-opacity="0.9">${dots}</g>`;
    }
    return `<g filter="url(#${u}centre-rag)">${s}</g>`;
  }

  function renderSVG(d, n, opts = {}) {
    const u = d.u = 'v' + (renderSVG.count = (renderSVG.count || 0) + 1).toString(36) + '-';
    const ns = d.noise, G = d.G;
    const defs = [
      `<filter id="${u}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>`,
      ragFilter(`${u}centre-rag`, ns + 70),
      // black felt ground: faint lighter mottling
      `<filter id="${u}felt" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="${ns + 80}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 0.6  0 0 0 0 0.58  0 0 0 1.2 -0.45"/></filter>`,
      // watercolour-paper grain over everything
      `<filter id="${u}grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="13" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.18  0 0 0 0 0.15  0 0 0 1.4 -0.6"/></filter>`,
      `<filter id="${u}tooth" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="17" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.95"/></filter>`,
    ];
    const rb = d.r1 * d.main.rbF;
    let flower = '';
    if (d.leaves) flower += renderLeaves(d, n, defs);
    if (d.back) flower += renderLayer(d.back, u + 'back', n, d, rb, Math.PI / n, d.back.extent, defs);
    flower += renderLayer(d.main, u + 'main', n, d, rb, 0, 1, defs);
    if (d.inner) {
      // an inner whorl reaching just past ring II
      const ext = Math.max(d.r2 * 1.08, rb + 30) / R;
      flower += renderLayer(d.inner, u + 'inner', n, d, rb * 0.8, Math.PI / n, ext, defs);
    }
    flower += renderCentre(d, n);

    const tile = `x="${-HALF}" y="${-HALF}" width="${HALF * 2}" height="${HALF * 2}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}">` +
      `<defs>${defs.join('')}</defs>` +
      `<rect ${tile} fill="${G.bg}"/><rect class="texture" ${tile} filter="url(#${u}felt)" opacity="0.08"/>` +
      `<g class="flower">${flower}</g>` +
      `<rect class="texture" ${tile} filter="url(#${u}grain)" opacity="0.35" style="mix-blend-mode:multiply"/>` +
      `<rect class="texture" ${tile} filter="url(#${u}tooth)" opacity="0.12"/>` +
      (opts.grid ? renderGrid(rings(d), n) : '') +
      `</svg>`;
  }

  // ---------- caption ----------
  const SHAPE_NAMES = { orbicular: 'round', spatulate: 'spoon', ovate: 'egg-shaped', elliptic: 'oval', flabellate: 'fan', lanceolate: 'pointed' };
  const EDGE_NAMES = { notch: ', notched', scallop: ', scalloped', fringe: ', fringed' };
  const STROKE_NAMES = { hatch: 'fine hatching', dab: 'short dabs', streak: 'long streaks', speckle: 'speckles' };
  const CENTRE_NAMES = { pollen: 'Stippled pollen disc', stamens: 'Dark eye with stamens', seedhead: 'Dotted seed head', eye: 'Dark eye ringed with dots' };

  function describe(d) {
    const L = d.main;
    let petal = `${L.F.name}, ${SHAPE_NAMES[L.shape]} petals${EDGE_NAMES[L.edge] || ''} · ${STROKE_NAMES[L.style]}, blotched`;
    if (d.back) petal += ' · second whorl behind';
    if (d.leaves) petal += ' · leaves';
    const middle = d.inner ? `Inner whorl of ${d.F2.name.toLowerCase()} · dark eye` : 'Dark eye bleeding into the petals';
    return {
      petal, middle, core: CENTRE_NAMES[d.centre.type], palette: `${d.F.name} · ${d.G.name}`,
      swatches: [d.F.base, d.F.blotch, d.F.light, d.F2.base, d.G.leaf[0], d.G.bg],
    };
  }

  function rings(d) {
    return [{ key: 'r1', r: d.r1, label: 'I  centre' }, { key: 'r2', r: d.r2, label: 'II  eye' }, { key: null, r: R, label: 'III  petal' }];
  }

  global.Flora.styles.paint = {
    label: 'Painterly',
    lede: 'Painterly texture with brush strokes, wet blotches and ragged edges.',
    defaultFolds: 6,
    foldRange: [5, 12],
    makeDesign, renderSVG, describe, rings,
  };
})(window);
