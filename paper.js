/* Floral Generator — "Playful" style (style key: paper).
 *
 * Simple cut-paper flowers: chunky rounded silhouettes with hand-cut edges in flat,
 * vibrant colour, layered sheet over sheet.
 *
 * Each paper layer goes through one filter: blur + alpha threshold fuses the petals into a
 * single rounded cut-out, and low-frequency displacement makes the edge look hand-cut.
 */
(function (global) {
  'use strict';

  const U = global.Flora.util;
  const { TAU, R, HALF, makeRng, hashSeed, mix, f1, polar, toDeg, poly, el, circ, dot, marks, fit, SHAPES, petalGeometry, renderGrid } = U;

  const INK = '#1b1a1e';
  // From the playful-illustration board: Matisse cobalt, tomato red, chartreuse paintings,
  // terracotta tiles, the sky-blue rabbit, pink and maroon cut-outs.
  const PALETTES = [
    { name: 'Matisse',      bg: '#f4ead6', petal: '#1f3fbf', back: '#5fb13f', collar: '#e9f08f', core: '#d8322a', dots: '#5fb13f' },
    { name: 'Tomato',       bg: '#ecebe7', petal: '#d1281f', back: '#f08a2c', collar: '#f7ecd2', core: '#1f3a8f', dots: '#1f3a8f' },
    { name: 'Lime light',   bg: '#b9b4dc', petal: '#e6f19a', back: '#5f9b4c', collar: '#fbf8ef', core: '#5f9b4c', dots: '#d8322a' },
    { name: 'Tulip',        bg: '#f7efe0', petal: '#ec5a2a', back: '#5c8f4e', collar: '#f8d65a', core: '#6e2a2c', dots: '#ec5a2a' },
    { name: 'Rabbit sky',   bg: '#4aa3e8', petal: '#fbfbf6', back: '#bfe0fa', collar: '#1f3fbf', core: '#e0413c', dots: '#fbfbf6' },
    { name: 'Terracotta',   bg: '#f3e3c6', petal: '#e8662a', back: '#6e2a2c', collar: '#d9c2d1', core: '#6e2a2c', dots: '#e8662a' },
    { name: 'Bubblegum',    bg: '#fbe1e8', petal: '#ef5f9a', back: '#f8d65a', collar: '#fff7f0', core: '#1f3fbf', dots: '#1f3fbf' },
    { name: 'Meadow',       bg: '#fdf5e1', petal: '#5fb13f', back: '#f8d65a', collar: '#fbfbf6', core: '#e8662a', dots: '#5fb13f' },
    { name: 'Plum & peach', bg: '#f6d4b6', petal: '#5a2d4a', back: '#ef8f5a', collar: '#f4a23c', core: '#f7ecd2', dots: '#5a2d4a' },
    { name: 'Primary',      bg: '#f8f4ea', petal: '#f8d23a', back: '#d8322a', collar: '#1f3fbf', core: '#d8322a', dots: '#1f3fbf' },
    { name: 'Lilac',        bg: '#efe7f1', petal: '#a99ee0', back: '#2a3fd0', collar: '#f7ecd2', core: '#f08a2c', dots: '#2a3fd0' },
    { name: 'Cherry',       bg: '#f3f0e8', petal: '#b8202a', back: '#f2a7c3', collar: '#f2a7c3', core: '#2b2257', dots: '#b8202a' },
  ];

  // ---------- design ----------
  function makeLayer(rng, role) {
    const shape = rng.weighted([['orbicular', 3], ['spatulate', 3], ['elliptic', 1.5], ['ovate', 1.5], ['lanceolate', 0.8], ['flabellate', 1]]);
    const rounded = shape !== 'lanceolate' && shape !== 'ovate';
    const notch = rounded && rng.chance(0.25);
    return {
      role, shape, cap: shape === 'flabellate' ? 'round' : null, capH: rng.range(0.6, 1),
      edge: notch ? 'notch' : 'none',
      E: notch ? { zone: rng.range(0.15, 0.25), depth: rng.range(0.1, 0.2) } : {},
      width: role === 'front' ? rng.range(1, 1.5) : rng.range(0.95, 1.4),
      extent: role === 'front' ? rng.range(0.82, 1) : rng.range(0.8, 1),
      rbF: rng.range(0.4, 0.9),
    };
  }

  function makeDesign(seed) {
    const rng = makeRng(seed);
    const P = rng.pick(PALETTES);
    const r1 = R * rng.range(0.1, 0.2);
    const r2 = R * rng.range(Math.max(0.24, r1 / R + 0.08), 0.42);
    const front = makeLayer(rng, 'front');
    const back = rng.chance(0.5) ? makeLayer(rng, 'back') : null;
    const collar = rng.weighted([['none', 3], ['disc', 2], ['lobes', 2], ['burst', 2], ['dots', 1]]);
    let collarColour = rng.pick([P.collar, P.back]);
    if (collarColour === P.core) collarColour = P.collar === P.core ? P.bg : P.collar;
    return {
      seed, pal: P, r1, r2, front, back,
      noise: hashSeed(String(seed)) % 997,
      goo: rng.range(8, 13), wobble: rng.range(10, 18),
      collar: { type: collar, colour: collarColour, m: rng.int(1, 3), offset: rng.chance(0.5) ? 0.5 : 0, depth: rng.range(0.7, 0.85) },
      core: { size: rng.range(0.65, 1), inner: rng.weighted([['none', 2], ['hole', 1], ['dot', 1]]) },
      lines: rng.chance(0.4) ? { count: rng.pick([1, 3, 3, 5]), w: rng.range(3, 6), len: rng.range(0.55, 0.85), tone: rng.pick(['light', 'dark']) } : null,
      // spots painted onto every front petal
      spots: rng.chance(0.5) ? {
        kind: rng.weighted([['dot', 2], ['trio', 2], ['diamond', 1.5]]), t: rng.range(0.55, 0.72), size: rng.range(7, 14),
        scale: rng.weighted([['medium', 2], ['small', 2], ['mixed', 1]]), // one size per flower, or a pair of both
      } : null,
    };
  }

  // ---------- filters ----------
  // Fuse the shapes into one rounded cut-out, then waver the edge as if cut by hand.
  function cutFilter(id, seed, goo, wobble) {
    return `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${f1(goo)}" result="b"/>` +
      `<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="2" seed="${seed}" result="w"/>` +
      `<feDisplacementMap in="goo" in2="w" scale="${f1(wobble)}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  }

  // painted strokes: a slightly wavering line
  function brushFilter(id, seed) {
    return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="${seed}" result="w"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="w" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  }

  // ---------- rendering ----------
  function petalRing(L, id, n, rb, offset, defs) {
    const g = petalGeometry(L, n, rb, 0);
    defs.push(`<path id="${id}" d="${g.d}"/>`);
    let uses = '';
    for (let s = 0; s < n; s++) uses += `<use xlink:href="#${id}" transform="rotate(${toDeg(s * TAU / n + offset)})"/>`;
    return { uses, g };
  }

  // painted strokes following each petal's length, like brushed veins
  function petalLines(d, g, L, n) {
    const ln = d.lines, sh = SHAPES[L.shape], k = (ln.count - 1) / 2;
    const vx = t => g.W * sh.f(Math.min(t, sh.peak));
    let p = '';
    for (let i = -k; i <= k; i++) {
      const q = k ? i / k * 0.5 : 0, pts = [];
      for (let j = 0; j <= 12; j++) { const t = 0.12 + (ln.len - 0.12) * j / 12; pts.push([q * vx(t), -(g.rb + g.len * t)]); }
      p += poly(pts, false);
    }
    let out = '';
    for (let s = 0; s < n; s++) out += `<path d="${p}" transform="rotate(${toDeg(s * TAU / n)})"/>`;
    return out;
  }

  function renderSVG(d, n, opts = {}) {
    const u = d.u = 'p' + (renderSVG.count = (renderSVG.count || 0) + 1).toString(36) + '-';
    const P = d.pal, ns = d.noise, alpha = TAU / n;
    const defs = [
      cutFilter(u + 'back', ns, d.goo, d.wobble),
      cutFilter(u + 'front', ns + 10, d.goo, d.wobble),
      cutFilter(u + 'mid', ns + 20, Math.min(d.goo, 5), d.wobble * 0.6),
      cutFilter(u + 'small', ns + 30, 1.5, 3),
      brushFilter(u + 'brush', ns + 40),
      `<filter id="${u}canvas" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.02" numOctaves="3" seed="${ns + 50}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.17  0 0 0 0 0.15  0 0 0 0.9 -0.32"/></filter>`,
    ];
    const rb = d.r1 * d.front.rbF;
    let flower = '';

    if (d.back) {
      const b = petalRing(d.back, u + 'bp', n, rb, alpha / 2, defs);
      flower += `<g fill="${P.back}" filter="url(#${u}back)">${b.uses}</g>`;
    }
    const f = petalRing(d.front, u + 'fp', n, rb, 0, defs);
    flower += `<g fill="${P.petal}" filter="url(#${u}front)">${f.uses}</g>`;

    if (d.lines) {
      const c = d.lines.tone === 'light' ? mix(P.petal, '#ffffff', 0.45) : mix(P.petal, INK, 0.35);
      flower += `<g fill="none" stroke="${c}" stroke-width="${f1(d.lines.w)}" stroke-linecap="round" filter="url(#${u}brush)">${petalLines(d, f.g, d.front, n)}</g>`;
    }

    // spots on each front petal, sized to stay inside it and clear of the collar
    if (d.spots) {
      const K = d.spots, g = f.g, sh = SHAPES[d.front.shape];
      const t = Math.max(K.t, (d.r2 + K.size * 3 - g.rb) / g.len);
      if (t < 0.85) {
        const hw = g.W * sh.f(t), y = -(g.rb + g.len * t);
        // Marks come medium (full size) or small; the 'mixed' variant pairs the two sizes.
        const SMALL = 0.55;
        const one = K.scale === 'small' ? SMALL : 1;
        let c = '';
        if (K.kind === 'trio') { // three dots; mixed = a medium dot above two small ones
          const s = Math.min(K.size, hw / 2.4) * one, low = K.scale === 'mixed' ? SMALL : 1;
          c = dot([0, y - s * 1.3], s * 0.85) + dot([-s * 1.3, y + s * 0.8], s * 0.85 * low) + dot([s * 1.3, y + s * 0.8], s * 0.85 * low);
        } else {
          // a dot or a small square turned 45° (pointing along the petal); mixed adds a smaller
          // twin further out (or further in if the tip is too narrow)
          const diamond = K.kind === 'diamond';
          const mark = (my, ms) => (diamond ? `<path d="${poly([[0, my - ms], [ms, my], [0, my + ms], [-ms, my]])}"/>` : dot([0, my], ms));
          const s = (diamond ? Math.min(K.size * 1.8, hw * 0.55) : Math.min(K.size, hw * 0.45)) * one;
          const s2 = s * SMALL, step = (s + s2) * 1.7;
          const fits = r => {
            const tt = (r - g.rb) / g.len;
            return tt < 0.85 && r > d.r2 + s2 * 2 && g.W * sh.f(tt) * (diamond ? 0.55 : 0.45) >= s2;
          };
          c = mark(y, s);
          if (K.scale === 'mixed') {
            if (fits(-y + step)) c += mark(y - step, s2);
            else if (fits(-y - step)) c += mark(y + step, s2);
          }
        }
        defs.push(`<g id="${u}spot">${c}</g>`);
        let uses = '';
        for (let k = 0; k < n; k++) uses += `<use xlink:href="#${u}spot" transform="rotate(${toDeg(k * alpha)})"/>`;
        const spotColour = [P.dots, P.core, P.collar, P.bg].find(x => x !== P.petal);
        // drawn before the collar, which may overlap them but never leaves one floating
        // the rounding blur would melt a small diamond's corners into a dot, so it stays crisp
        const filter = K.kind === 'diamond' ? '' : ` filter="url(#${u}small)"`;
        flower += `<g fill="${spotColour}"${filter}>${uses}</g>`;
      }
    }

    // II · collar
    const C = d.collar, cc = C.colour;
    if (C.type === 'disc') {
      flower += `<g filter="url(#${u}mid)">${circ(d.r2, { fill: cc })}</g>`;
    } else if (C.type === 'lobes') {
      const L = { shape: 'orbicular', width: 1.25, extent: d.r2 / R, edge: 'none', E: {} };
      const lob = petalRing(L, u + 'cl', n, d.r1 * 0.5, C.offset * alpha, defs);
      flower += `<g fill="${cc}" filter="url(#${u}mid)">${lob.uses}${circ(d.r1 * 1.1, {})}</g>`;
    } else if (C.type === 'burst') {
      const m = fit(n, C.m + 1, d.r2, 16), step = alpha / m, pts = [];
      for (const { a } of marks(n, m, C.offset)) pts.push(polar(d.r2, a), polar(d.r2 * C.depth, a + step / 2));
      flower += `<g filter="url(#${u}mid)">${el('path', { d: poly(pts), fill: cc })}</g>`;
    } else if (C.type === 'dots') {
      // a paper disc with a ring of dots around it, so no dot floats on its own
      const r = (d.r1 + d.r2) / 2, m = fit(n, C.m, r, 26);
      const rad = Math.min(TAU * r / (n * m) * 0.3, (d.r2 - d.r1) * 0.32);
      let ds = '';
      for (const { a } of marks(n, m, C.offset)) ds += dot(polar(r, a), rad);
      flower += `<g filter="url(#${u}mid)">${circ(d.r2, { fill: cc })}</g>`;
      flower += `<g fill="${[P.dots, P.core, P.petal].find(c => c !== cc)}" filter="url(#${u}small)">${ds}</g>`;
    }

    // I · core: a paper button, sometimes punched or with a dot
    const cr = d.r1 * d.core.size;
    // separate cuts, so the colours don't bleed into each other in the fusing blur
    flower += `<g filter="url(#${u}mid)">${circ(cr, { fill: P.core })}</g>`;
    const inner = d.core.inner === 'hole' ? circ(cr * 0.42, { fill: P.bg })
      : d.core.inner === 'dot' ? circ(cr * 0.38, { fill: P.dots === P.core ? P.collar : P.dots }) : '';
    if (inner) flower += `<g filter="url(#${u}small)">${inner}</g>`;

    const tile = `x="${-HALF}" y="${-HALF}" width="${HALF * 2}" height="${HALF * 2}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}">` +
      `<defs>${defs.join('')}</defs>` +
      `<rect ${tile} fill="${P.bg}"/><rect class="texture" ${tile} filter="url(#${u}canvas)" opacity="0.05"/>` +
      `<g class="flower">${flower}</g>` +
      (opts.grid ? renderGrid(rings(d), n) : '') +
      `</svg>`;
  }

  // ---------- caption ----------
  const SHAPE_NAMES = { orbicular: 'Round lobes', spatulate: 'Spoon petals', elliptic: 'Oval petals', ovate: 'Egg-shaped petals', lanceolate: 'Star points', flabellate: 'Fan petals' };
  const COLLAR_NAMES = { none: 'Bare, no collar', disc: 'Paper disc', lobes: 'Scalloped paper collar', burst: 'Starburst', dots: 'Dotted paper disc' };
  const INNER = { none: '', hole: ', punched through', dot: ' with a dot' };

  function describe(d) {
    let petal = SHAPE_NAMES[d.front.shape] + (d.front.edge === 'notch' ? ', heart-tipped' : '');
    petal += ' · cut paper';
    if (d.back) petal += ' · second sheet behind';
    if (d.lines) petal += ' · painted strokes';
    if (d.spots) {
      const size = { medium: '', small: 'small ', mixed: 'big-and-small ' }[d.spots.scale];
      petal += ` · ${size}${{ dot: 'dots', trio: 'dot trios', diamond: 'diamonds' }[d.spots.kind]} on each`;
    }
    let middle = COLLAR_NAMES[d.collar.type];

    const P = d.pal;
    return {
      petal, middle, core: 'Paper button' + INNER[d.core.inner],
      palette: P.name,
      swatches: [P.petal, P.back, d.collar.colour, P.core, P.dots, P.bg],
    };
  }

  function rings(d) {
    return [{ key: 'r1', r: d.r1, label: 'I  core' }, { key: 'r2', r: d.r2, label: 'II  collar' }, { key: null, r: R, label: 'III  petal' }];
  }

  global.Flora.styles.paper = {
    label: 'Playful',
    foldRange: [6, 14],
    lede: 'Cut-paper style with vibrant color palette.',
    makeDesign, renderSVG, describe, rings, PALETTES,
  };
})(window);
