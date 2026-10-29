/* Radial Flora — "Translucent" style (style key: butterfly).
 *
 * Scanned-flower look: translucent petals washed in diluted colour, fine veins,
 * a soft blurred ink centre, and deep colour only in a dip at each tip, like butterfly wings.
 * Colours come from the pressed-flower studies (visual-ref/color inspo).
 *
 * Geometry stays exactly symmetric per fold. The watercolour noise (edge wobble, smoky pigment)
 * is sampled in tile space, so each petal's texture differs slightly, as in a real scan.
 */
(function (global) {
  'use strict';

  const U = global.Flora.util;
  const { TAU, R, HALF, makeRng, hashSeed, mix, f1, toDeg, poly, el, circ, dot, SHAPES, petalGeometry, renderGrid } = U;

  // Sampled from the pressed-flower photos: columbine, pansy, forget-me-not, hydrangea,
  // bellflower, nigella, pimpernel, bleeding heart, fern.
  const PALETTES = [
    { name: 'Columbine',      wash: ['#c98aa6', '#e9c7d3', '#b9a6cb'], ink: '#3a2232', burn: '#8a5a3c', paper: '#f4f0ee' },
    { name: 'Pansy',          wash: ['#5a4ea0', '#9a92d4', '#dcd6ef'], ink: '#1b1530', burn: '#5b4a2a', paper: '#f2f1f4' },
    { name: 'Forget-me-not',  wash: ['#8ea7dc', '#c9d6ef', '#ece0b4'], ink: '#26304a', burn: '#7a6a4a', paper: '#f2f3f5' },
    { name: 'Hydrangea',      wash: ['#c79fc8', '#dcae8c', '#ecdcda'], ink: '#43292c', burn: '#94653f', paper: '#f5efea' },
    { name: 'Bellflower',     wash: ['#7c6dc2', '#b9b0e2', '#dcc8d8'], ink: '#231d3d', burn: '#6b5a3a', paper: '#f2f0f3' },
    { name: 'Nigella',        wash: ['#dfe3d3', '#b6c196', '#d6dde7'], ink: '#2c3524', burn: '#7c7a3e', paper: '#f3f3ef' },
    { name: 'Pimpernel',      wash: ['#da8276', '#f1bdb0', '#e8d6cf'], ink: '#47201e', burn: '#8b4a2e', paper: '#f6f0ec' },
    { name: 'Bleeding heart', wash: ['#d49aae', '#f0dbe1', '#c7b3c4'], ink: '#5a2d3d', burn: '#8a5a46', paper: '#f5f0f0' },
    { name: 'Fern & violet',  wash: ['#8fa06a', '#c9b8e0', '#e6e3d4'], ink: '#28301f', burn: '#6f6235', paper: '#f3f2ee' },
  ];
  // Pale warm/cool pairs for two-tone petals: warm at the heart, cool toward the tip
  // (pansy yellow / forget-me-not blue, hydrangea peach / bellflower lilac, ...).
  const TWO_TONES = [
    { name: 'yellow → blue', warm: '#efe1a4', cool: '#c5d3ee' },
    { name: 'peach → periwinkle', warm: '#f2d8bc', cool: '#cbd0ec' },
    { name: 'lemon → lilac', warm: '#eee6ae', cool: '#d5cbe9' },
    { name: 'blush → aqua', warm: '#f3d6dc', cool: '#c9dfe4' },
    { name: 'cream → cornflower', warm: '#f1e9cf', cool: '#bfcdec' },
  ];
  const SUMI = '#1d1a1b'; // plain ink, used instead of the palette's tinted ink some of the time
  const lum = h => { const v = parseInt(h.slice(1), 16); return 0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255); };

  // ---------- design ----------
  function makeLayer(rng, P, role, ink, twoTone) {
    const shape = rng.weighted([['spatulate', 4], ['ovate', 2], ['elliptic', 1.5], ['orbicular', 1.5], ['flabellate', 1], ['lanceolate', 0.3]]);
    const edge = rng.weighted([['none', 5], ['notch', shape === 'lanceolate' ? 0 : 1.4], ['scallop', 0.6], ['serrate', 0.4]]);
    const E = {
      none: {},
      notch: { zone: rng.range(0.15, 0.25), depth: rng.range(0.06, 0.14) },
      scallop: { zone: rng.range(0.3, 0.5), depth: rng.range(0.02, 0.04), teeth: rng.int(2, 3) },
      serrate: { zone: 0.5, depth: rng.range(0.01, 0.02), teeth: rng.int(5, 9) },
    }[edge];

    // Colour rule: the body is a pale, low-contrast wash; the palette's deepest colour is
    // only allowed in a dip at the tip, fading into the body. (Banded washes along the petal
    // line up across petals into concentric "halo" rings, so there are none.)
    const byDepth = P.wash.slice().sort((x, y) => lum(x) - lum(y));
    const lights = byDepth.slice(1);
    // body colours are softened toward the paper, so neighbouring tones barely differ
    const base = twoTone ? mix(twoTone.warm, P.paper, rng.range(0.1, 0.25)) : mix(rng.pick(lights), P.paper, rng.range(0.25, 0.45));
    const toward = twoTone ? mix(twoTone.cool, P.paper, rng.range(0.05, 0.2)) : mix(rng.pick(lights), P.paper, rng.range(0.2, 0.4));
    const tip = rng.chance(role === 'main' ? 0.75 : 0.4) ? {
      colour: rng.chance(0.3) ? ink : mix(byDepth[0], P.ink, rng.range(0.1, 0.4)),
      alpha: rng.range(0.82, 0.95),
      eyes: rng.chance(0.4) ? rng.int(1, 2) : 0, eyeSize: rng.range(2.5, 5),
    } : null;

    return {
      role, shape, edge, E,
      cap: shape === 'flabellate' ? 'round' : null, capH: rng.range(0.6, 0.9),
      width: role === 'main' ? rng.range(1.1, 1.5) : rng.range(0.9, 1.3),
      extent: role === 'main' ? 1 : rng.range(0.8, 0.95),
      rbF: rng.range(0.05, 0.25), // petals meet almost at the centre, so no paper shows through
      base, toward, tip, tone: base, bodyAlpha: rng.range(0.5, 0.7),
      opacity: role === 'main' ? rng.range(0.7, 0.9) : rng.range(0.4, 0.65),
      veinGap: rng.range(4, 9), veinAlpha: rng.range(0.14, 0.32),
      pool: rng.chance(0.7) ? rng.range(3, 6) : 0,
      tipBurn: !tip && rng.chance(0.4), // a scorched tip stands in for the dip when there is none
      burnSize: rng.range(6, 12),
    };
  }

  function makeDesign(seed) {
    const rng = makeRng(seed);
    const P = rng.pick(PALETTES);
    const ink = rng.chance(0.4) ? SUMI : P.ink;
    const r1 = R * rng.range(0.08, 0.15);
    const r2 = R * rng.range(Math.max(0.22, r1 / R + 0.09), 0.34);
    // three in four flowers have two colours in the light area (warm heart, cool toward the tip)
    const twoTone = rng.chance(0.75) ? rng.pick(TWO_TONES) : null;
    const main = makeLayer(rng, P, 'main', ink, twoTone);
    const back = rng.chance(0.55) ? makeLayer(rng, P, 'back', ink, twoTone) : null;
    return {
      seed, pal: P, ink, r1, r2, main, back, twoTone,
      // ring III: where the dark tip begins (a small outer band by default)
      tip: R * (1 - rng.range(0.12, 0.24)),
      noise: hashSeed(String(seed)) % 997,
      // the centre is a single small blurred circle
      centre: {
        size: rng.range(0.8, 1.3), blur: rng.range(0.2, 0.32), strength: rng.range(0.8, 0.95),
        colour: rng.chance(0.3) ? mix(ink, rng.pick(P.wash), 0.35) : ink,
      },
    };
  }

  // ---------- rendering ----------
  function renderLayer(L, id, n, d, rb, offset, defs) {
    const g = petalGeometry(L, n, rb, 0);
    const P = d.pal, ink = d.ink, sh = SHAPES[L.shape];
    const parts = [];

    // pale body, thinner at the base so stacked petals don't build a bright disc round the centre
    defs.push(`<linearGradient id="${id}-wash" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(-rb)}" x2="0" y2="${f1(-g.Rt)}">` +
      `<stop offset="0" stop-color="${L.base}" stop-opacity="${(L.bodyAlpha * 0.4).toFixed(2)}"/>` +
      `<stop offset="${Math.min(0.9, Math.max(0.05, (d.r2 - rb) / (g.Rt - rb))).toFixed(3)}" stop-color="${L.base}" stop-opacity="${L.bodyAlpha.toFixed(2)}"/>` +
      `<stop offset="1" stop-color="${L.toward}" stop-opacity="${L.bodyAlpha.toFixed(2)}"/></linearGradient>`);
    defs.push(`<clipPath id="${id}-clip"><path d="${g.d}"/></clipPath>`);
    parts.push(el('path', { d: g.d, fill: `url(#${id}-wash)` }));

    let inner = '';

    // Deep-coloured tip: an enlarged petal minus a copy of itself slid toward the base (and widened
    // a lot, so only the tip is left). Its edge follows the tip's own curve, so neighbouring petals
    // never line up into a ring. A wide blur fades it gradually into the body; because the shape
    // overshoots the petal outline, only that inner edge fades and the very tip stays dark.
    // Colour starts to appear at ring III (d.tip, scaled for a shorter back layer).
    const tipY = Math.min(...g.outline.filter(([x]) => Math.abs(x) < 1).map(([, y]) => y)); // tip point on the axis (furthest out)
    const tipStart = d.tip * L.extent, zone = -tipY - tipStart;
    if (L.tip && zone > 4) {
      const T = L.tip, fade = Math.max(3, zone * 0.25), D = zone - 2 * fade;
      const big = poly(g.outline.map(([x, y]) => [x * 1.3, -rb + (y + rb) * 1.3]));
      const slid = poly(g.outline.map(([x, y]) => [x * 1.8, y + D]));
      defs.push(`<filter id="${id}-fade" x="-40%" y="-40%" width="180%" height="180%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${d.noise + 2}"/>` +
        `<feDisplacementMap in="SourceGraphic" scale="8" xChannelSelector="R" yChannelSelector="G"/>` +
        `<feGaussianBlur stdDeviation="${f1(fade)}"/></filter>`);
      inner += el('path', { d: big + slid, 'fill-rule': 'evenodd', fill: T.colour, 'fill-opacity': T.alpha.toFixed(2), filter: `url(#${id}-fade)` });
      if (T.eyes) {
        const ey = -(tipStart - T.eyeSize * 2.5);
        let eyes = dot([0, ey], T.eyeSize);
        if (T.eyes > 1) {
          const ex = g.W * sh.f(Math.min(0.98, (tipStart - rb) / g.len)) * 0.4;
          eyes += dot([ex, ey - T.eyeSize * 2], T.eyeSize * 0.7) + dot([-ex, ey - T.eyeSize * 2], T.eyeSize * 0.7);
        }
        inner += `<g fill="${T.colour}" fill-opacity="0.85" filter="url(#${d.u}soft)">${eyes}</g>`;
      }
    }

    // veins: fan out from the base, run parallel past the widest point, clipped by the tip
    const K = Math.max(3, Math.min(40, Math.round(g.W / L.veinGap)));
    const vx = t => g.W * sh.f(Math.min(t, sh.peak));
    let veins = '';
    for (let k = -K; k <= K; k++) {
      const q = k / K * 0.96, pts = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([q * vx(t), -(rb + g.len * t)]); }
      pts.push([q * vx(1), -(g.Rt + 20)]);
      veins += poly(pts, false);
    }
    const vc = mix(L.tone, ink, 0.65);
    inner += el('path', { d: veins, fill: 'none', stroke: vc, 'stroke-opacity': L.veinAlpha.toFixed(2), 'stroke-width': '0.6' });
    inner += el('path', { d: `M0 ${f1(-rb)}L0 ${f1(-g.Rt)}`, stroke: vc, 'stroke-opacity': Math.min(0.6, L.veinAlpha + 0.15).toFixed(2), 'stroke-width': '1' });

    // watercolour edge darkening: pigment pools where the wash dries at the rim
    // light edge darkening: pigment settles a little where the wash dries at the rim
    if (L.pool) {
      inner += el('path', { d: g.d, fill: 'none', stroke: mix(L.tone, ink, 0.25), 'stroke-width': (L.pool * 2).toFixed(1), 'stroke-opacity': '0.25', filter: `url(#${d.u}blur)` });
    }

    // a scorched tip (only on petals without a coloured dip)
    if (L.tipBurn) {
      const s = L.burnSize;
      inner += `<g fill="${P.burn}" fill-opacity="0.6" filter="url(#${d.u}soft)">${dot([0, -g.Rt], s * 1.3)}</g>` +
        `<g fill="${mix(P.burn, ink, 0.5)}" fill-opacity="0.75">${dot([0, -g.Rt + 2], s * 0.25)}</g>`;
    }

    parts.push(`<g clip-path="url(#${id}-clip)">${inner}</g>`);
    parts.push(el('path', { d: g.d, fill: 'none', stroke: mix(L.tone, ink, 0.35), 'stroke-opacity': '0.12', 'stroke-width': '0.6' }));
    defs.push(`<g id="${id}-unit" opacity="${L.opacity.toFixed(2)}">${parts.join('')}</g>`);

    // Translucent petals: overlap order barely shows, so no seam fix is needed here.
    const alpha = TAU / n;
    let out = '';
    for (let s = 0; s < n; s++) out += `<use xlink:href="#${id}-unit" transform="rotate(${toDeg(s * alpha + offset)})"/>`;
    return `<g filter="url(#${d.u}wobble)">${out}</g>`;
  }

  function renderCentre(d) {
    const C = d.centre, r = d.r1 * C.size;
    return `<filter id="${d.u}centre" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${f1(r * C.blur)}"/></filter>` +
      circ(r, { fill: C.colour, 'fill-opacity': C.strength.toFixed(2), filter: `url(#${d.u}centre)` }) +
      circ(Math.max(3, r * 0.13), { fill: '#fbfaf7', 'fill-opacity': '0.95' }); // a small white eye
  }

  function renderSVG(d, n, opts = {}) {
    const u = d.u = 'b' + (renderSVG.count = (renderSVG.count || 0) + 1).toString(36) + '-';
    const ns = d.noise;
    const P = d.pal;
    const defs = [
      // petals: wavering edges, then pigment that settles unevenly (alpha × low-frequency noise)
      `<filter id="${u}wobble" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="${ns}" result="warp"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="warp" scale="7" xChannelSelector="R" yChannelSelector="G" result="shape"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.0025 0.005" numOctaves="2" seed="${ns + 5}" result="mottle"/>` +
      `<feGaussianBlur in="mottle" stdDeviation="14" result="cloud"/>` +
      `<feColorMatrix in="cloud" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.8 0 0 0 0.55" result="mask"/>` +
      `<feComposite in="shape" in2="mask" operator="in"/><feGaussianBlur stdDeviation="0.35"/></filter>`,
`<filter id="${u}blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5"/></filter>`,
      `<filter id="${u}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>`,
      `<filter id="${u}paper" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="${ns + 3}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.36  0 0 0 0.6 -0.25"/></filter>`,
      `<filter id="${u}grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.27  0 0 0 0 0.27  0 0 0 1.2 -0.55"/></filter>`,
    ];
    const rb = d.r1 * d.main.rbF;
    // Petals pinch in at the base, leaving paper-coloured gaps around the centre that read as a
    // pale ring. A soft wash of the petal colour underneath fills them, like a flower's dense heart.
    const heart = d.r2, base = mix(d.main.base, d.ink, 0.15); // ring II: the soft heart
    let flower = `<radialGradient id="${u}heart" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${f1(heart)}">` +
      `<stop offset="0" stop-color="${base}" stop-opacity="0.85"/><stop offset="0.55" stop-color="${base}" stop-opacity="0.55"/>` +
      `<stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>` +
      circ(heart, { fill: `url(#${u}heart)` });
    if (d.back) flower += renderLayer(d.back, u + 'back', n, d, rb, Math.PI / n, defs);
    flower += renderLayer(d.main, u + 'main', n, d, rb, 0, defs);
    flower += `<g class="centre">${renderCentre(d)}</g>`;

    const tile = `x="${-HALF}" y="${-HALF}" width="${HALF * 2}" height="${HALF * 2}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}">` +
      `<defs>${defs.join('')}</defs>` +
      `<rect ${tile} fill="${P.paper}"/><rect class="texture" ${tile} filter="url(#${u}paper)" opacity="0.3"/>` +
      `<g class="flower">${flower}</g>` +
      `<rect class="texture" ${tile} filter="url(#${u}grain)" opacity="0.3" style="mix-blend-mode:multiply"/>` +
      (opts.grid ? renderGrid(rings(d), n) : '') +
      `</svg>`;
  }

  // ---------- caption ----------
  const SHAPE_NAMES = { ovate: 'Ovate', elliptic: 'Elliptic', lanceolate: 'Lanceolate', spatulate: 'Spatulate', orbicular: 'Orbicular', flabellate: 'Fan' };
  const EDGE_NAMES = { notch: 'notched', scallop: 'scalloped', serrate: 'serrated' };

  function describe(d) {
    const L = d.main;
    let petal = SHAPE_NAMES[L.shape] + (L.edge !== 'none' ? ', ' + EDGE_NAMES[L.edge] : '') + (d.twoTone ? ` · two-tone wash, ${d.twoTone.name}` : ' · translucent wash');
    if (L.tip) petal += L.tip.colour === d.ink ? ' · ink-dipped tips' : ' · deep-coloured tips';
    if (L.tipBurn) petal += ' · scorched tips';
    if (d.back) petal += ' · two layers';
    return {
      petal, middle: 'Petals only (no middle detail)', core: 'Small blurred ink circle with a white eye',
      palette: d.pal.name, swatches: [...(d.twoTone ? [d.twoTone.warm, d.twoTone.cool] : []), ...d.pal.wash, d.centre.colour],
    };
  }

  function rings(d) {
    return [
      { key: 'r1', r: d.r1, label: 'I  core' }, { key: 'r2', r: d.r2, label: 'II  heart' },
      { key: 'tip', r: d.tip, label: 'III  tip' }, { key: null, r: R, label: 'IV  petal' },
    ];
  }

  global.Flora.styles.butterfly = {
    label: 'Translucent',
    defaultFolds: 8,
    foldRange: [5, 14],
    lede: 'Scanned flowers with translucent, butterfly-wing petals: a soft ink wash, fine veins, and a blurred ink centre. The colours come from pressed-flower studies.',
    makeDesign, renderSVG, describe, rings, PALETTES,
  };
})(window);
