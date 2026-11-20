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
  const foldRanges = {}; // petal ranges the user set for Randomize, per direction (else the style's own)
  let design = null;
  // "All style overview": every direction side by side, each card with its own seed and
  // petal count (Randomize gives them all one new seed; clicking a card reshuffles just it)
  const ov = { seeds: {}, folds: {}, past: [] };
  let view = 'single'; // or 'all', 'garden'
  // "Garden randomization": many biased Translucent flowers at once, each with its own seed
  // (a Garden design carries its own petal count)
  const GARDEN = Flora.garden;
  // full: the "Full colour range" switch (every palette and wash equally likely)
  const gd = { seeds: [], past: [], full: false };

  // one tab per visual direction
  const tabs = $('#tabs');
  // directions are numbered from 0, in tab order: "0. Giorgia Lupi (trial)", "1. Translucent", ...
  const styleTitle = key => `${Object.keys(STYLES).indexOf(key)}. ${STYLES[key].label}`;
  // the overview tab comes first, then one tab per direction, then the garden
  tabs.innerHTML = `<button class="tab" role="tab" type="button" data-view="all" id="tab-all">All style overview</button>` +
    Object.keys(STYLES).map(key =>
      `<button class="tab" role="tab" type="button" data-style="${key}" id="tab-${key}">${styleTitle(key)}</button>`).join('') +
    `<button class="tab" role="tab" type="button" data-view="garden" id="tab-garden">${GARDEN.label}</button>`;
  const TAB_ORDER = ['all', ...Object.keys(STYLES), 'garden'];

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const folds = parseInt(p.get('folds'), 10);
    if (p.get('view') === 'all') view = 'all';
    if (p.get('view') === 'garden') {
      view = 'garden';
      gd.seeds = (p.get('seeds') || '').toUpperCase().split(',').filter(Boolean).map(s => s.slice(0, 12)).slice(0, GARDEN.count);
      gd.full = p.get('colours') === 'all';
    }
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
  // and render properly once it is released. New designs replace the old with a hard cut.
  function render(draft) {
    if (view === 'all') return renderOverview();
    if (view === 'garden') return renderGarden();
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

    document.body.dataset.style = state.style;
    document.body.dataset.view = 'single';
    updateTabs(state.style);
    $('.stage').setAttribute('aria-labelledby', 'tab-' + state.style);
    $('#style-title').textContent = styleTitle(state.style);
    $('#style-lede').textContent = style.lede;

    const info = style.describe(design);
    $('#seed-label').textContent = 'No. ' + state.seed;
    $('#fold-note').textContent = state.folds + ' petals';
    $('#folds-value').textContent = state.folds;
    $('#fold-icon').innerHTML = foldIcon(state.folds);
    $('#r-petal').textContent = info.petal;
    $('#r-middle').textContent = info.middle;
    $('#r-core').textContent = info.core;
    $('#r-palette').textContent = info.palette;
    $('#swatches').innerHTML = info.swatches.map(h => `<i style="background:${h}"></i>`).join('');
    document.documentElement.style.setProperty('--accent', design.palette ? design.palette.accent : design.ink);
    $('#back').disabled = past.length === 0;
    updateRangeRow();
    tile.setAttribute('aria-label', `Flower ${state.seed}, ${state.folds} petals: ${info.petal}; ${info.middle}; ${info.core}`);
    const moved = Object.entries(state.rings).filter(([k]) => k in design.ringDefaults);
    $('#reset-rings').hidden = !moved.length;
    const ringParams = moved.map(([k, v]) => `&${k}=${Math.round(v)}`).join('');
    history.replaceState(null, '', `#style=${state.style}&seed=${state.seed}&folds=${state.folds}${ringParams}`);
  }

  function updateTabs(selected) {
    for (const t of tabs.children) {
      const on = (t.dataset.style || t.dataset.view) === selected;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    }
  }

  // ---------- All style overview ----------
  const styleRange = key => STYLES[key].foldRange || [MIN, MAX];
  const foldRange = key => foldRanges[key] || styleRange(key);
  const randomFolds = key => {
    const [lo, hi] = foldRange(key);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  };

  const cardSVG = key => STYLES[key].renderSVG(STYLES[key].makeDesign(ov.seeds[key]), ov.folds[key], {});

  function renderOverview(only) {
    const grid = $('#overview-grid');
    if (only) { // just one card changed
      grid.querySelector(`.ov-tile[data-style="${only}"]`).firstElementChild.outerHTML = cardSVG(only);
    } else {
      grid.innerHTML = Object.keys(STYLES).map(key => `<div class="ov-card">` +
        `<button class="ov-tile" type="button" data-style="${key}" aria-label="Randomize ${styleTitle(key)}" title="Click to randomize">` +
        cardSVG(key) + `<span class="ov-label" aria-hidden="true">${styleTitle(key)}</span></button>` +
        `<button class="ov-open" type="button" data-style="${key}" aria-label="Open ${styleTitle(key)} in its own tab" title="Open in its own tab">↗</button>` +
        `</div>`).join('');
    }
    document.body.dataset.view = 'all';
    document.body.dataset.style = 'all';
    updateTabs('all');
    $('#ov-back').disabled = !ov.past.length;
    // one seed when the cards share it, otherwise each card's own
    const seeds = Object.values(ov.seeds), shared = seeds.every(x => x === seeds[0]);
    history.replaceState(null, '', '#view=all&' +
      (shared ? `seed=${seeds[0]}` : Object.entries(ov.seeds).map(([k, v]) => `${k}=${v}`).join('&')));
  }

  // ---------- Garden randomization ----------
  // the colour mode is part of the name, since the same seed is coloured differently in each
  const gardenFile = seed => `flora-garden${gd.full ? '-allcolours' : ''}-${seed}-${GARDEN.makeDesign(seed, gd.full).folds}`;

  function gardenCard(seed, i) {
    const d = GARDEN.makeDesign(seed, gd.full), info = GARDEN.describe(d);
    return `<div class="gd-card" data-i="${i}">` +
      `<button class="gd-tile" type="button" data-i="${i}" title="Click to reshuffle" ` +
      `aria-label="Flower ${seed}, ${d.folds} petals: ${info.petal}. Click to reshuffle">${GARDEN.renderSVG(d, d.folds, { bare: true })}</button>` +
      `<span class="gd-label" aria-hidden="true">No. ${seed} · ${d.folds} petals</span>` +
      `<button class="gd-save" type="button" data-i="${i}" aria-label="Save flower ${seed} as PNG" title="Save as PNG">↓</button>` +
      `</div>`;
  }

  function renderGarden(only) {
    const grid = $('#garden-grid');
    if (only !== undefined) grid.querySelector(`.gd-card[data-i="${only}"]`).outerHTML = gardenCard(gd.seeds[only], only);
    else grid.innerHTML = gd.seeds.map(gardenCard).join('');
    document.body.dataset.view = 'garden';
    document.body.dataset.style = 'garden';
    updateTabs('garden');
    $('#gd-back').disabled = !gd.past.length;
    $('#gd-full-colour').checked = gd.full;
    $('#gd-colour-note').textContent = gd.full ? 'Every palette and wash equally likely' : 'Favouring the favourites’ palettes';
    history.replaceState(null, '', '#view=garden&seeds=' + gd.seeds.join(',') + (gd.full ? '&colours=all' : ''));
  }

  // flipping the switch recolours the same 20 flowers (their shapes stay put)
  function setFullColour(on) {
    gd.full = on;
    renderGarden();
  }

  function showGarden(focus) {
    if (view === 'garden') return;
    if (gd.seeds.length !== GARDEN.count) gd.seeds = Array.from({ length: GARDEN.count }, () => Flora.randomSeed());
    view = 'garden';
    render();
    if (focus) $('#tab-garden').focus();
  }

  function gdRemember() {
    gd.past.push(gd.seeds.slice());
    if (gd.past.length > 100) gd.past.shift();
  }
  function gdRandomize() {
    gdRemember();
    gd.seeds = gd.seeds.map(() => Flora.randomSeed());
    renderGarden();
  }
  function gdRandomizeOne(i) {
    gdRemember();
    gd.seeds[i] = Flora.randomSeed();
    renderGarden(i);
  }
  function gdBack() {
    if (!gd.past.length) return;
    gd.seeds = gd.past.pop();
    renderGarden();
  }

  function showOverview(focus) {
    if (view === 'all') return;
    for (const key in STYLES) ov.seeds[key] = state.seed;
    for (const key in STYLES) ov.folds[key] = key === state.style ? state.folds : defaultFolds(key);
    view = 'all';
    render();
    if (focus) $('#tab-all').focus();
  }

  function ovRemember() {
    ov.past.push({ seeds: { ...ov.seeds }, folds: { ...ov.folds } });
    if (ov.past.length > 100) ov.past.shift();
  }

  // every card gets one new seed, and a petal count from its own style's range
  function ovRandomize() {
    ovRemember();
    const seed = Flora.randomSeed();
    for (const key in STYLES) { ov.seeds[key] = seed; ov.folds[key] = randomFolds(key); }
    render();
  }

  // clicking a card reshuffles just that card
  function ovRandomizeOne(key) {
    ovRemember();
    ov.seeds[key] = Flora.randomSeed();
    ov.folds[key] = randomFolds(key);
    renderOverview(key);
  }

  // Back undoes the last change, whether it was one card or all of them
  function ovBack() {
    if (!ov.past.length) return;
    Object.assign(ov, ov.past.pop());
    render();
  }

  // the ↗ button opens that direction in its own tab with the same flower
  function openFromOverview(key) {
    state.style = key;
    state.seed = ov.seeds[key];
    state.folds = ov.folds[key];
    slider.value = state.folds;
    state.rings = {};
    view = 'single';
    render();
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
      state.folds = randomFolds(state.style);
      slider.value = state.folds;
    }
    render();
  }

  function goBack() {
    if (!past.length) return;
    const prev = past.pop();
    state.seed = prev.seed;
    if (!state.lockFolds) { state.folds = prev.folds; slider.value = state.folds; }
    state.rings = {};
    render();
  }

  function setLockFolds(on) {
    state.lockFolds = on;
    $('#lock-folds').checked = on;
    updateRangeRow();
  }

  // ---------- petal range for Randomize (only while unlocked) ----------
  const minInput = $('#fold-min'), maxInput = $('#fold-max');

  function updateRangeRow() {
    $('#fold-range').hidden = state.lockFolds;
    const [lo, hi] = foldRange(state.style);
    if (document.activeElement !== minInput) minInput.value = lo;
    if (document.activeElement !== maxInput) maxInput.value = hi;
  }

  // the edited end stays put; the other end moves if needed so min never passes max
  function setFoldRange(which) {
    const input = which === 'min' ? minInput : maxInput;
    let [lo, hi] = foldRange(state.style);
    const v = parseInt(input.value, 10);
    if (v > 0) {
      const n = Math.max(MIN, Math.min(MAX, v));
      if (which === 'min') { lo = n; hi = Math.max(hi, n); } else { hi = n; lo = Math.min(lo, n); }
      const [dLo, dHi] = styleRange(state.style);
      if (lo === dLo && hi === dHi) delete foldRanges[state.style];
      else foldRanges[state.style] = [lo, hi];
    }
    minInput.value = lo; maxInput.value = hi;
    updateRangeRow();
  }

  function setFolds(n, draft) {
    state.folds = Math.max(MIN, Math.min(MAX, n));
    slider.value = state.folds;
    render(draft);
  }

  // each direction opens at its own fold count (Translucent reads best with fewer, broader petals)
  const defaultFolds = key => STYLES[key].defaultFolds || 12;

  function setStyle(key, focus) {
    if (!STYLES[key] || (key === state.style && view === 'single')) return;
    view = 'single';
    state.style = key;
    state.rings = {};
    if (!state.lockFolds) { state.folds = defaultFolds(key); slider.value = state.folds; }
    render();
    if (focus) $('#tab-' + key).focus();
  }

  function setGrid(on) {
    state.grid = on;
    $('#grid').checked = on;
    render();
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
    drag.frame = requestAnimationFrame(() => { drag.frame = 0; render(true); }); // draft while moving
  }

  function endDrag() {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    window.removeEventListener('pointermove', onDrag);
    window.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('pointerup', endDrag);
    document.body.classList.remove('dragging-ring');
    drag = null;
    render();
  }

  // ---------- export ----------
  function svgString(el = tile.querySelector('svg')) {
    const svg = el.cloneNode(true);
    svg.setAttribute('width', '1000');
    svg.setAttribute('height', '1000');
    return new XMLSerializer().serializeToString(svg);
  }

  function savePNG(el, name) {
    const url = URL.createObjectURL(new Blob([svgString(el)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const size = 2400, canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => download(b, name + '.png'), 'image/png');
    };
    img.src = url;
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

  $('#dl-png').addEventListener('click', () => savePNG(tile.querySelector('svg'), fileBase()));

  // ---------- wiring ----------
  const goTo = (key, focus) => key === 'all' ? showOverview(focus) : key === 'garden' ? showGarden(focus) : setStyle(key, focus);
  slider.addEventListener('input', () => setFolds(+slider.value, true));
  slider.addEventListener('change', () => setFolds(+slider.value));
  tabs.addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) goTo(t.dataset.view || t.dataset.style);
  });
  $('#garden-grid').addEventListener('click', e => {
    const save = e.target.closest('.gd-save'), t = e.target.closest('.gd-tile');
    if (save) savePNG(save.closest('.gd-card').querySelector('svg'), gardenFile(gd.seeds[+save.dataset.i]));
    else if (t) gdRandomizeOne(+t.dataset.i);
  });
  $('#gd-randomize').addEventListener('click', gdRandomize);
  $('#gd-full-colour').addEventListener('change', e => setFullColour(e.target.checked));
  $('#gd-back').addEventListener('click', gdBack);
  $('#overview-grid').addEventListener('click', e => {
    const open = e.target.closest('.ov-open'), tile = e.target.closest('.ov-tile');
    if (open) openFromOverview(open.dataset.style);
    else if (tile) ovRandomizeOne(tile.dataset.style);
  });
  $('#ov-randomize').addEventListener('click', ovRandomize);
  $('#ov-back').addEventListener('click', ovBack);
  $('#randomize').addEventListener('click', randomize);
  $('#back').addEventListener('click', goBack);
  $('#grid').addEventListener('change', e => setGrid(e.target.checked));
  $('#lock-folds').addEventListener('change', e => setLockFolds(e.target.checked));
  $('#reset-rings').addEventListener('click', () => { state.rings = {}; render(); });
  minInput.addEventListener('change', () => setFoldRange('min'));
  maxInput.addEventListener('change', () => setFoldRange('max'));
  $('#reset-range').addEventListener('click', () => { delete foldRanges[state.style]; updateRangeRow(); });

  // the grid's info tooltip also opens on tap (touch has no hover); Escape or a tap elsewhere closes it
  const info = $('#grid-info'), infoBtn = info.querySelector('button');
  const setInfo = open => { info.classList.toggle('open', open); infoBtn.setAttribute('aria-expanded', open); };
  infoBtn.addEventListener('click', e => { e.stopPropagation(); setInfo(!info.classList.contains('open')); });
  document.addEventListener('click', () => setInfo(false));
  info.addEventListener('keydown', e => { if (e.key === 'Escape') { setInfo(false); infoBtn.blur(); } });

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const onButton = t.tagName === 'BUTTON';
    const onSlider = t === slider;
    if (t === minInput || t === maxInput) return; // typing a petal range
    if (t.getAttribute && t.getAttribute('role') === 'tab' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const i = TAB_ORDER.indexOf(view === 'single' ? state.style : view);
      goTo(TAB_ORDER[(i + (e.key === 'ArrowRight' ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length], true);
      return;
    }
    if (view !== 'single') { // only randomizing applies here (and the colour switch in the garden)
      // (Space on the focused colour switch flips it rather than randomizing)
      if ((e.key === ' ' || e.key === 'r' || e.key === 'R') && !onButton && !(e.key === ' ' && t.type === 'checkbox')) { e.preventDefault(); view === 'all' ? ovRandomize() : gdRandomize(); }
      else if (view === 'garden' && (e.key === 'c' || e.key === 'C')) setFullColour(!gd.full);
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

  // ---------- local dev: redraw under the current rules when the code changes ----------
  // Every flower is drawn from its seed when the page loads, so reloading brings the same seeds
  // (kept in the URL) back under whatever rules the code now has. While working on localhost,
  // poll the source files and reload when one changes; the Back histories survive the reload.
  // The live site never polls.
  const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const HISTORY_KEY = 'flora-dev-history';
  if (DEV) {
    try { // restore the Back histories saved just before a code-change reload
      const h = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || 'null');
      sessionStorage.removeItem(HISTORY_KEY);
      if (h) { past.push(...h.past); ov.past.push(...h.ov); gd.past.push(...h.gd); }
    } catch (e) { /* storage unavailable: start without history */ }
    const FILES = ['index.html', 'styles.css', 'flora.js', 'butterfly.js', 'paper.js', 'paint.js', 'app.js'];
    const stamp = () => Promise.all(FILES.map(f => fetch(f, { method: 'HEAD', cache: 'no-store' })
      .then(r => (r.ok ? r.headers.get('Last-Modified') + '/' + r.headers.get('Content-Length') : null))
      .catch(() => null)));
    let seen = null;
    setInterval(async () => {
      const s = await stamp();
      if (s.includes(null)) return; // server down or mid-write: try again next time
      const key = s.join('|');
      if (seen === null) { seen = key; return; }
      if (key === seen) return;
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ past, ov: ov.past, gd: gd.past })); } catch (e) { /* no history kept */ }
      location.reload();
    }, 1000);
  }

  readHash();
  if (!state.seed) state.seed = Flora.randomSeed();
  slider.value = state.folds;
  // the browser may restore the toggles from before a reload; match them to the state
  $('#lock-folds').checked = state.lockFolds;
  $('#grid').checked = state.grid;
  if (view === 'all') { // opened from an overview link: one shared seed, or one per card
    const p = new URLSearchParams(location.hash.slice(1));
    for (const key in STYLES) {
      ov.seeds[key] = (p.get(key) || state.seed).toUpperCase().slice(0, 12);
      ov.folds[key] = defaultFolds(key);
    }
  }
  if (view === 'garden') { // opened from a garden link: top up to a full garden if it was short
    while (gd.seeds.length < GARDEN.count) gd.seeds.push(Flora.randomSeed());
  }
  render();
})();
