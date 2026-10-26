(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const tile = $('#tile');
  const slider = $('#folds');
  const MIN = +slider.min, MAX = +slider.max;

  const state = { seed: null, folds: 12, grid: false };
  const past = []; // previous seeds, for the Back button
  let design = null;

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const folds = parseInt(p.get('folds'), 10);
    if (p.get('seed')) state.seed = p.get('seed').toUpperCase().slice(0, 12);
    if (folds >= MIN && folds <= MAX) state.folds = folds;
  }

  function foldIcon(n) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2;
      d += `M0 0L${(10 * Math.sin(a)).toFixed(2)} ${(-10 * Math.cos(a)).toFixed(2)}`;
    }
    return `<circle r="10" fill="none" stroke="currentColor" stroke-width="1"/><path d="${d}" stroke="currentColor" stroke-width="${n > 20 ? 0.5 : 0.8}"/>`;
  }

  function render(animate) {
    if (!design || design.seed !== state.seed) design = Flora.makeDesign(state.seed);
    tile.innerHTML = Flora.renderSVG(design, state.folds, { grid: state.grid });
    if (animate) tile.querySelector('.flower').classList.add('bloom');

    const info = Flora.describe(design);
    $('#seed-label').textContent = 'No. ' + state.seed;
    $('#fold-note').textContent = state.folds + ' folds';
    $('#folds-value').textContent = state.folds;
    $('#fold-icon').innerHTML = foldIcon(state.folds);
    $('#r-petal').textContent = info.petal;
    $('#r-middle').textContent = info.middle;
    $('#r-core').textContent = info.core;
    $('#r-palette').textContent = info.palette;
    const c = design.col;
    $('#swatches').innerHTML = [c.pA, c.pB, c.mA, c.mB, c.cA, c.ink]
      .map(h => `<i style="background:${h}"></i>`).join('');
    document.documentElement.style.setProperty('--accent', design.palette.accent);
    $('#back').disabled = past.length === 0;
    tile.setAttribute('aria-label', `Flower ${state.seed}, ${state.folds} folds: ${info.petal}; ${info.middle}; ${info.core}`);
    history.replaceState(null, '', `#seed=${state.seed}&folds=${state.folds}`);
  }

  function randomize() {
    past.push(state.seed);
    if (past.length > 100) past.shift();
    state.seed = Flora.randomSeed();
    render(true);
  }

  function goBack() {
    if (!past.length) return;
    state.seed = past.pop();
    render(true);
  }

  function setFolds(n) {
    state.folds = Math.max(MIN, Math.min(MAX, n));
    slider.value = state.folds;
    render(false);
  }

  function setGrid(on) {
    state.grid = on;
    $('#grid').checked = on;
    render(false);
  }

  // ---------- export ----------
  function svgString() {
    const svg = tile.querySelector('svg').cloneNode(true);
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

  const fileBase = () => `flora-${state.seed}-${state.folds}`;

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
  slider.addEventListener('input', () => setFolds(+slider.value));
  $('#randomize').addEventListener('click', randomize);
  $('#back').addEventListener('click', goBack);
  $('#grid').addEventListener('change', e => setGrid(e.target.checked));

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const onButton = t.tagName === 'BUTTON';
    const onSlider = t === slider;
    if ((e.key === ' ' || e.key === 'r' || e.key === 'R') && !onButton) {
      e.preventDefault();
      randomize();
    } else if (e.key === 'g' || e.key === 'G') {
      setGrid(!state.grid);
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
