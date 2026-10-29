(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const tile = $('#tile');
  const slider = $('#folds');
  const MIN = +slider.min, MAX = +slider.max;

  const STYLES = Flora.styles;
  // rings: radii the user has dragged, overriding the design's own (cleared for a new design)
  const state = { style: 'lupi', seed: null, folds: 12, grid: false, rings: {}, lockFolds: true }; // folds locked by default
  const RING_KEYS = ['r1', 'r2', 'tip'];
  const RING_GAP = 14; // closest two rings may get, in tile units
  const past = []; // previous { seed, folds }, for the Back button
  let design = null;

  // one tab per visual direction
  const tabs = $('#tabs');
  // directions are numbered from 0, in tab order: "0. Giorgia Lupi (trial)", "1. Translucent", ...
  const styleTitle = key => `${Object.keys(STYLES).indexOf(key)}. ${STYLES[key].label}`;
  tabs.innerHTML = Object.keys(STYLES).map(key =>
    `<button class="tab" role="tab" type="button" data-style="${key}" id="tab-${key}">${styleTitle(key)}</button>`).join('');

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const folds = parseInt(p.get('folds'), 10);
    if (p.get('seed')) state.seed = p.get('seed').toUpperCase().slice(0, 12);
    if (STYLES[p.get('style')]) state.style = p.get('style');
    state.folds = folds > 0 ? Math.max(MIN, Math.min(MAX, folds)) : defaultFolds(state.style);
    for (const k of RING_KEYS) { const v = parseFloat(p.get(k)); if (v > 0) state.rings[k] = v; }
  }

  function foldIcon(n) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2;
      d += `M0 0L${(10 * Math.sin(a)).toFixed(2)} ${(-10 * Math.cos(a)).toFixed(2)}`;
    }
    return `<circle r="10" fill="none" stroke="currentColor" stroke-width="1"/><path d="${d}" stroke="currentColor" stroke-width="${n > 20 ? 0.5 : 0.8}"/>`;
  }

  // While the slider is dragging, skip SVG filters (the watercolour ones are slow to rasterise)
  // and render properly once it is released.
  function render(animate, draft) {
    const style = STYLES[state.style];
    if (!design || design.seed !== state.seed || design.style !== state.style) {
      design = style.makeDesign(state.seed);
      design.style = state.style;
      design.ringDefaults = {};
      for (const { key, r } of style.rings(design)) if (key) design.ringDefaults[key] = r;
    }
    for (const key in design.ringDefaults) design[key] = state.rings[key] ?? design.ringDefaults[key];
    clampRings(style);
    const svg = style.renderSVG(design, state.folds, { grid: state.grid });
    // Draft: drop the texture layers (rects that exist only to carry a noise filter; without it
    // they'd fill black) and strip the remaining filters.
    tile.innerHTML = draft
      ? svg.replace(/<rect class="texture"[^>]*\/>/g, '').replace(/\sfilter="url\([^)]*\)"/g, '')
      : svg;
    if (animate) {
      tile.querySelector('.flower').classList.add('bloom');
      tile.firstElementChild.classList.add('bloom');
    }

    document.body.dataset.style = state.style;
    for (const t of tabs.children) {
      const on = t.dataset.style === state.style;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    }
    $('.stage').setAttribute('aria-labelledby', 'tab-' + state.style);
    $('#style-title').textContent = styleTitle(state.style);
    $('#style-lede').textContent = style.lede;

    const info = style.describe(design);
    $('#seed-label').textContent = 'No. ' + state.seed;
    $('#fold-note').textContent = state.folds + ' folds';
    $('#folds-value').textContent = state.folds;
    $('#fold-icon').innerHTML = foldIcon(state.folds);
    $('#r-petal').textContent = info.petal;
    $('#r-middle').textContent = info.middle;
    $('#r-core').textContent = info.core;
    $('#r-palette').textContent = info.palette;
    $('#swatches').innerHTML = info.swatches.map(h => `<i style="background:${h}"></i>`).join('');
    document.documentElement.style.setProperty('--accent', design.palette ? design.palette.accent : design.ink);
    $('#back').disabled = past.length === 0;
    tile.setAttribute('aria-label', `Flower ${state.seed}, ${state.folds} folds: ${info.petal}; ${info.middle}; ${info.core}`);
    const moved = Object.entries(state.rings).filter(([k]) => k in design.ringDefaults);
    $('#reset-rings').hidden = !moved.length;
    const ringParams = moved.map(([k, v]) => `&${k}=${Math.round(v)}`).join('');
    history.replaceState(null, '', `#style=${state.style}&seed=${state.seed}&folds=${state.folds}${ringParams}`);
  }

  // keep rings in order with a little space between them (e.g. after a shared link or a drag)
  function clampRings(style) {
    const list = style.rings(design);
    for (let i = 0; i < list.length; i++) {
      const { key } = list[i];
      if (!key) continue;
      const lo = i ? list[i - 1].r + RING_GAP : 8, hi = list[i + 1].r - RING_GAP;
      design[key] = list[i].r = Math.max(lo, Math.min(hi, design[key]));
      if (key in state.rings) state.rings[key] = design[key];
    }
  }

  // a new design also gets a new fold count from the style's range, unless folds are locked
  function randomize() {
    past.push({ seed: state.seed, folds: state.folds });
    if (past.length > 100) past.shift();
    state.seed = Flora.randomSeed();
    state.rings = {};
    if (!state.lockFolds) {
      const [lo, hi] = STYLES[state.style].foldRange || [MIN, MAX];
      state.folds = lo + Math.floor(Math.random() * (hi - lo + 1));
      slider.value = state.folds;
    }
    render(true);
  }

  function goBack() {
    if (!past.length) return;
    const prev = past.pop();
    state.seed = prev.seed;
    if (!state.lockFolds) { state.folds = prev.folds; slider.value = state.folds; }
    state.rings = {};
    render(true);
  }

  function setLockFolds(on) {
    state.lockFolds = on;
    $('#lock-folds').checked = on;
  }

  function setFolds(n, draft) {
    state.folds = Math.max(MIN, Math.min(MAX, n));
    slider.value = state.folds;
    render(false, draft);
  }

  // each direction opens at its own fold count (Translucent reads best with fewer, broader petals)
  const defaultFolds = key => STYLES[key].defaultFolds || 12;

  function setStyle(key, focus) {
    if (!STYLES[key] || key === state.style) return;
    state.style = key;
    state.rings = {};
    if (!state.lockFolds) { state.folds = defaultFolds(key); slider.value = state.folds; }
    render(true);
    if (focus) $('#tab-' + key).focus();
  }

  function setGrid(on) {
    state.grid = on;
    $('#grid').checked = on;
    render(false);
  }

  // ---------- dragging the rings (grid on) ----------
  let drag = null;

  function svgRadius(e) {
    const svg = tile.querySelector('svg');
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return Math.hypot(q.x, q.y);
  }

  tile.addEventListener('pointerdown', e => {
    const hit = e.target.closest && e.target.closest('[data-ring]');
    if (!hit) return;
    e.preventDefault();
    drag = { key: hit.dataset.ring, frame: 0 };
    document.body.classList.add('dragging-ring');
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', endDrag, { once: true });
    window.addEventListener('pointercancel', endDrag, { once: true });
  });

  function onDrag(e) {
    state.rings[drag.key] = svgRadius(e);
    if (drag.frame) return;
    drag.frame = requestAnimationFrame(() => { drag.frame = 0; render(false, true); }); // draft while moving
  }

  function endDrag() {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    window.removeEventListener('pointermove', onDrag);
    window.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('pointerup', endDrag);
    document.body.classList.remove('dragging-ring');
    drag = null;
    render(false);
  }

  // ---------- export ----------
  function svgString() {
    const svg = tile.querySelector('svg').cloneNode(true);
    svg.classList.remove('bloom');
    svg.querySelector('.flower').classList.remove('bloom');
    svg.setAttribute('width', '1000');
    svg.setAttribute('height', '1000');
    return new XMLSerializer().serializeToString(svg);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const fileBase = () => `flora-${state.style}-${state.seed}-${state.folds}`;

  $('#dl-svg').addEventListener('click', () => {
    download(new Blob([svgString()], { type: 'image/svg+xml' }), fileBase() + '.svg');
  });

  $('#dl-png').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([svgString()], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const size = 2400, canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => download(b, fileBase() + '.png'), 'image/png');
    };
    img.src = url;
  });

  // ---------- wiring ----------
  slider.addEventListener('input', () => setFolds(+slider.value, true));
  slider.addEventListener('change', () => setFolds(+slider.value));
  tabs.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setStyle(t.dataset.style); });
  $('#randomize').addEventListener('click', randomize);
  $('#back').addEventListener('click', goBack);
  $('#grid').addEventListener('change', e => setGrid(e.target.checked));
  $('#lock-folds').addEventListener('change', e => setLockFolds(e.target.checked));
  $('#reset-rings').addEventListener('click', () => { state.rings = {}; render(false); });

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const onButton = t.tagName === 'BUTTON';
    const onSlider = t === slider;
    if (t.getAttribute && t.getAttribute('role') === 'tab' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const keys = Object.keys(STYLES), i = keys.indexOf(state.style);
      setStyle(keys[(i + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length], true);
      return;
    }
    if ((e.key === ' ' || e.key === 'r' || e.key === 'R') && !onButton) {
      e.preventDefault();
      randomize();
    } else if (e.key === 'g' || e.key === 'G') {
      setGrid(!state.grid);
    } else if (e.key === 'l' || e.key === 'L') {
      setLockFolds(!state.lockFolds);
    } else if (!onSlider && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      setFolds(state.folds + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });

  readHash();
  if (!state.seed) state.seed = Flora.randomSeed();
  slider.value = state.folds;
  render(true);
})();
