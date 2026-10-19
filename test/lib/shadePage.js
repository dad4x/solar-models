// The render page under a stub DOM, for the test parts. Each part loads its own copy of the page (runPage), so the parts can run in
// separate processes; see test/run-parallel.js. The stub is the same one the single smoke file used.
// Runs the render page script against a stub DOM: the first draw and the site inputs, the time zone lookup (with a stubbed
// fetch), the clock and day sliders, the per-row settings, the year totals, and scenario save and load, including older
// files (version 1 with shifts, version 3 with top-left positions, version 4 with "proposed", version 5 with a UTC offset).
const fs = require('fs'), vm = require('vm');
const htmlPath = process.argv[2] || require('path').join(__dirname, '..', '..', 'array_shading_render.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeCtx2d() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'fillText') { t[k] = (s, x, y) => { (t.__texts = t.__texts || []).push({ text: String(s), x: x, y: y }); }; return t[k]; }
      // Line ends, so a test can see how far a line reaches across the drawing.
      if (k === 'moveTo' || k === 'lineTo') { t[k] = (x, y) => { (t.__pts = t.__pts || []).push({ x: x, y: y }); }; return t[k]; }
      t[k] = () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
const elements = {};
function makeClassList() {
  const s = new Set();
  return {
    add: c => { s.add(c); },
    remove: c => { s.delete(c); },
    contains: c => s.has(c),
    toggle: (c, force) => { const on = force === undefined ? !s.has(c) : !!force; if (on) s.add(c); else s.delete(c); return on; }
  };
}
function makeEl(id, init) {
  const e = Object.assign({
    id: id, value: '', checked: false, textContent: '', innerHTML: '', classList: makeClassList(),
    width: 640, height: 460, listeners: {}, _ctx: null,
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    setPointerCapture() {},
    getContext() { return this._ctx || (this._ctx = makeCtx2d()); },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  }, init || {});
  return e;
}

// Row defaults as the page has them: panels, as-drawn gaps (inches), and the baseline locations on graph paper as
// right and up in ft from the origin 0,0. The extra inner north and south rows are off.
const ROWS = ['OL', 'IL', 'IR', 'OR', 'N', 'NI', 'SI', 'S', 'X1', 'X2', 'X3', 'X4'];
const DNS = ['N', 'NI', 'SI', 'S', 'X1', 'X2', 'X3', 'X4'];
const N_DEF = { OL: 10, IL: 7, IR: 7, OR: 10, N: 5, NI: 5, SI: 5, S: 5, X1: 5, X2: 5, X3: 5, X4: 5 };
const GAP = { OL: '10.068', IL: '13.772', IR: '13.772', OR: '10.068', N: '8.327', NI: '8.327', SI: '8.327', S: '8.327', X1: '8.327', X2: '8.327', X3: '8.327', X4: '8.327' };
const BASE_O = { OL: 3, IL: 3, IR: 3, OR: 3, N: 3, NI: 3, SI: 3, S: 3, X1: 3, X2: 3, X3: 3, X4: 3 };
const BASE_A = { OL: 3, IL: 5, IR: 5, OR: 3, N: 5, NI: 5, SI: 5, S: 3, X1: 5, X2: 5, X3: 5, X4: 5 };
const RIGHT = { OL: 0.5, IL: 12.9, IR: 24.1, OR: 36.2, N: 10, NI: 10, SI: 10, S: 10, X1: 10, X2: 10, X3: 10, X4: 10 };
const UP = { OL: 0, IL: 8, IR: 8, OR: 0, N: 42, NI: 30, SI: 12, S: 0, X1: 54, X2: 66, X3: 78, X4: 90 };
// Version 3 layout: each row's top-left corner, left of the old origin and down from the old top edge.
const LEFT3 = { OL: 0, IL: 12.4, IR: 18.728, OR: 30.828, N: 9.5, NI: 9.5, SI: 9.5, S: 9.5, X1: 9.5, X2: 9.5, X3: 9.5, X4: 9.5 };
const DOWN3 = { OL: 4.872, IL: 7.872, IR: 7.872, OR: 4.872, N: 0, NI: 12, SI: 30, S: 42, X1: -12, X2: -24, X3: -36, X4: -48 };
const onOf = g => g !== 'NI' && g !== 'SI' && !g.startsWith('X');

const defaults = {
  rise: {}, wallh: {}, walldx: {}, alb: {}, bif: {}, rating: {}, sf: {}, cap: {}, meas: {},
  latitude: {}, longitude: {}, timeZone: {}, zoneLookup: {}, zoneStatus: {}, zoneList: {}, trueNorthOffset: {},
  stage: {}, boxO: {}, boxA: {}, boxT: {}, ctrlO: {}, ctrlA: {}, modO: {}, modA: {}, moduleInfo: {}, seasonLabel: {}, seasons: {},
  helpPop: {},
  day: { value: '355' }, time: { value: '9' },
  knobsO: {}, knobsA: {}, yearLabel: {}, addRowO: {}, addColO: {}, addRowA: {}, addColA: {},
  scName: { value: 'Scenario 1' }, scSave: {}, scFile: { files: [], value: '' }, scText: { value: '' },
  scLoadText: {}, scStatus: {}, cmp: {},
  tip: { style: {}, offsetWidth: 200 },
  cO: { width: 640, height: 460 }, cA: { width: 640, height: 460 },
  capO: {}, capA: {}, timeLabel: {}, dateLabel: {}, sum: {}, grp: {}, mticks: {}, vticks: {},
  gr: { width: 640, height: 130 }, grPlan: {}, grAlt: {}, grTitle: {}, grUse: {},
  dg: { width: 640, height: 130 }, dgPlan: {}, dgAlt: {}, dgTitle: {}, dgUse: {},
  useFile: { files: [], value: '' }, useText: { value: '' }, useLoadText: {}, useClear: {}, useStatus: {}, useSum: {},
  batKwh: { value: '60' }, batDis: { value: '10' }, batChg: { value: '10' }, batEff: { value: '90' }
};
for (const [pre, base] of [['o_', BASE_O], ['a_', BASE_A]]) {
  defaults[pre + 'all_dx'] = { value: '0' };
  defaults[pre + 'all_dy'] = { value: '0' };
  for (const g of ROWS) {
    defaults[pre + g + '_on'] = { checked: onOf(g), type: 'checkbox' };
    // Each row's box, folded while its On box is off, as the page builds it.
    const rowBox = makeClassList(); if (!onOf(g)) rowBox.add('collapsed');
    defaults['rb_' + pre + g] = { classList: rowBox };
    defaults[pre + g + '_n'] = { value: String(N_DEF[g]) };
    defaults[pre + g + '_base'] = { value: String(base[g]) };
    defaults[pre + g + '_tilt'] = { value: '45' };
    defaults[pre + g + '_gap'] = { value: GAP[g] };
    defaults[pre + g + '_right'] = { value: String(RIGHT[g]) };
    defaults[pre + g + '_up'] = { value: String(UP[g]) };
    if (DNS.indexOf(g) >= 0) defaults[pre + g + '_dz'] = { value: '0' };
    // The slider over each number box: the page keeps the two in step (a drag sets the number box and then its slider).
    for (const k of ['base', 'tilt', 'gap', 'right', 'up'].concat(DNS.indexOf(g) >= 0 ? ['dz'] : [])) {
      defaults[pre + g + '_' + k + '_sl'] = {};
    }
  }
  defaults[pre + 'all_dx_sl'] = {};
  defaults[pre + 'all_dy_sl'] = {};
}
for (let k = 0; k < 5; k++) {
  defaults['o' + k] = { width: 300, height: 220 };
  defaults['a' + k] = { width: 300, height: 220 };
}
for (const id of Object.keys(defaults)) elements[id] = makeEl(id, defaults[id]);

const docListeners = {};
const document = {
  getElementById(id) {
    if (!elements[id]) throw new Error('missing element #' + id);
    return elements[id];
  },
  querySelectorAll() { return []; },
  addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); }
};
const pending = [];
const flush = () => { while (pending.length) pending.shift()(); };
// The lookup's fetch is stubbed: it answers with mockZone, or fails when mockFail is set. Every URL is recorded.
const state = { mockZone: 'America/Los_Angeles', mockFail: false };
const fetchUrls = [];
const ctx = {
  console: console, Math: Math, JSON: JSON, document: document, setTimeout: fn => pending.push(fn),
  fetch: url => {
    fetchUrls.push(url);
    if (state.mockFail) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ timezone: state.mockZone }) });
  }
};
vm.createContext(ctx);

let fails = 0;
function expectEq(name, got, want) {
  const pass = got === want;
  if (!pass) fails++;
  console.log((pass ? 'ok    ' : 'FAIL  ') + name + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
}
const tick = () => new Promise(r => setImmediate(r));
const fire = (id, type) => (elements[id].listeners[type] || []).forEach(fn => fn());
const fireEv = (id, type, ev) => (elements[id].listeners[type] || []).forEach(fn => fn(ev));
const setVal = (id, v) => { elements[id].value = v; };
const setChk = (id, v) => { elements[id].checked = v; };
const yearText = () => elements.yearLabel.innerHTML.replace(/<[^>]+>/g, '');
const summaryRow = label => {
  const re = new RegExp(label + '[^<]*<\\/td><td>([^<]*)<\\/td><td>([^<]*)');
  const hit = elements.sum.innerHTML.match(re) || [];
  return { original: hit[1], alternative: hit[2] };
};
const diffCount = () => (elements.cmp.innerHTML.match(/class="diff"/g) || []).length;
const capO = () => (elements.capO.textContent.match(/(\d+) modules/) || [])[1];
const capA = () => (elements.capA.textContent.match(/(\d+) modules/) || [])[1];
const onlySide = (rows, all) => Object.assign({ rows: rows }, all);
const rowsOf = fn => { const o = {}; ROWS.forEach(g => { o[g] = fn(g); }); return o; };
// Ticks or unticks one row's On box and sends the change the browser sends, with the box as its target.
const rowOn = (prefix, g, on) => { setChk(prefix + g + '_on', on); fireEv(prefix === 'o_' ? 'knobsO' : 'knobsA', 'change', { target: elements[prefix + g + '_on'] }); };
const rowFolded = (prefix, g) => elements['rb_' + prefix + g].classList.contains('collapsed');
const checkedRows = prefix => ROWS.filter(g => elements[prefix + g + '_on'].checked).length;
// The scenario object inside a saved file's text, read the way the page's own parser reads it.
const scenarioOf = text => { const i = text.indexOf('var ARRAY_SCENARIO'); return JSON.parse(text.slice(text.indexOf('=', i) + 1).trim().replace(/;\s*$/, '')); };
const SITE = { rise: '5', wallh: '3', walldx: '1.3', alb: '0.4', bif: '0.7', rating: '500', sf: '0.85', cap: '10', meas: 'local' };
const loadRaw = obj => { elements.scText.value = 'var ARRAY_SCENARIO = ' + JSON.stringify(obj) + ';'; fire('scLoadText', 'click'); flush(); };
const LOOMIS_YEAR = 'Year, kWh: plan 40,437 · alternative 41,087';

function runPage() { vm.runInContext(script, ctx); }
// Prints the part's summary and sets its exit code: 1 when any check failed.
function finish() {
  console.log(fails ? fails + ' check(s) failed' : 'all checks passed');
  process.exitCode = fails ? 1 : 0;
  console.log('done');
}
module.exports = { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush,
  yearText, summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw,
  LOOMIS_YEAR, ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state, runPage, finish };
