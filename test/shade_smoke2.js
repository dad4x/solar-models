// Runs the render page script against a stub DOM: the first draw and the site inputs, the time zone lookup (with a stubbed
// fetch), the clock and day sliders, the per-row settings, the year totals, and scenario save and load, including older
// files (version 1 with shifts, version 3 with top-left positions, version 4 with "proposed", version 5 with a UTC offset).
const fs = require('fs'), vm = require('vm');
const htmlPath = process.argv[2] || require('path').join(__dirname, '..', 'array_shading_render.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeCtx2d() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'fillText') { t[k] = (s, x, y) => { (t.__texts = t.__texts || []).push({ text: String(s), x: x, y: y }); }; return t[k]; }
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
const ROWS = ['OL', 'IL', 'IR', 'OR', 'N', 'NI', 'SI', 'S'];
const DNS = ['N', 'NI', 'SI', 'S'];
const N_DEF = { OL: 10, IL: 7, IR: 7, OR: 10, N: 5, NI: 5, SI: 5, S: 5 };
const GAP = { OL: '10.068', IL: '13.772', IR: '13.772', OR: '10.068', N: '8.327', NI: '8.327', SI: '8.327', S: '8.327' };
const BASE_O = { OL: 3, IL: 3, IR: 3, OR: 3, N: 3, NI: 3, SI: 3, S: 3 };
const BASE_A = { OL: 3, IL: 5, IR: 5, OR: 3, N: 5, NI: 5, SI: 5, S: 3 };
const RIGHT = { OL: 0.5, IL: 12.9, IR: 24.1, OR: 36.2, N: 10, NI: 10, SI: 10, S: 10 };
const UP = { OL: 0, IL: 8, IR: 8, OR: 0, N: 42, NI: 30, SI: 12, S: 0 };
// Version 3 layout: each row's top-left corner, left of the old origin and down from the old top edge.
const LEFT3 = { OL: 0, IL: 12.4, IR: 18.728, OR: 30.828, N: 9.5, NI: 9.5, SI: 9.5, S: 9.5 };
const DOWN3 = { OL: 4.872, IL: 7.872, IR: 7.872, OR: 4.872, N: 0, NI: 12, SI: 30, S: 42 };
const onOf = g => g !== 'NI' && g !== 'SI';

const defaults = {
  rise: {}, wallh: {}, walldx: {}, alb: {}, bif: {}, rating: {}, sf: {}, cap: {}, meas: {},
  latitude: {}, longitude: {}, timeZone: {}, zoneLookup: {}, zoneStatus: {}, zoneList: {}, trueNorthOffset: {},
  stage: {}, boxO: {}, boxA: {}, boxT: {}, ctrlO: {}, ctrlA: {}, modO: {}, modA: {}, moduleInfo: {}, seasonLabel: {}, seasons: {},
  helpPop: {},
  day: { value: '355' }, time: { value: '9' },
  knobsO: {}, knobsA: {}, yearLabel: {},
  scName: { value: 'Scenario 1' }, scSave: {}, scFile: { files: [], value: '' }, scText: { value: '' },
  scLoadText: {}, scStatus: {}, cmp: {},
  tip: { style: {}, offsetWidth: 200 },
  cO: { width: 640, height: 460 }, cA: { width: 640, height: 460 },
  capO: {}, capA: {}, timeLabel: {}, dateLabel: {}, sum: {}, grp: {}, mticks: {}, vticks: {},
  gr: { width: 640, height: 130 }, grPlan: {}, grAlt: {}, grTitle: {}, grUse: {},
  dg: { width: 640, height: 130 }, dgPlan: {}, dgAlt: {}, dgTitle: {}, dgUse: {},
  useFile: { files: [], value: '' }, useText: { value: '' }, useLoadText: {}, useClear: {}, useStatus: {}, useSum: {}
};
for (const [pre, base] of [['o_', BASE_O], ['a_', BASE_A]]) {
  defaults[pre + 'all_dx'] = { value: '0' };
  defaults[pre + 'all_dy'] = { value: '0' };
  for (const g of ROWS) {
    defaults[pre + g + '_on'] = { checked: onOf(g) };
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
let mockZone = 'America/Los_Angeles', mockFail = false;
const fetchUrls = [];
const ctx = {
  console: console, Math: Math, JSON: JSON, document: document, setTimeout: fn => pending.push(fn),
  fetch: url => {
    fetchUrls.push(url);
    if (mockFail) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ timezone: mockZone }) });
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
const SITE = { rise: '5', wallh: '3', walldx: '1.3', alb: '0.4', bif: '0.7', rating: '500', sf: '0.85', cap: '10', meas: 'local' };
const loadRaw = obj => { elements.scText.value = 'var ARRAY_SCENARIO = ' + JSON.stringify(obj) + ';'; fire('scLoadText', 'click'); flush(); };
const LOOMIS_YEAR = 'Year, kWh: plan 40,437 · alternative 41,087';

(async () => {
  const t0 = Date.now();
  vm.runInContext(script, ctx);
  console.log('initial redraw ok in', Date.now() - t0, 'ms');
  expectEq('date label on load', elements.dateLabel.textContent, 'Dec 21   (day 355 of 365)');
  expectEq('the date graph labels its months', ['Jan', 'Jun', 'Dec'].every(n => elements.dg._ctx.__texts.some(t => t.text === n)), true);
  expectEq('location loads: latitude', elements.latitude.value, '38.8');
  expectEq('location loads: longitude', elements.longitude.value, '-121.2');
  expectEq('location loads: time zone', elements.timeZone.value, 'America/Los_Angeles');
  expectEq('the zone list is filled', /<option value="America\/Los_Angeles">/.test(elements.zoneList.innerHTML), true);
  expectEq('clock label on load carries the zone name', /^9:00 am PST /.test(elements.timeLabel.textContent), true);
  expectEq('no lookup on load', fetchUrls.length, 0);
  flush();
  expectEq('year after the yearly steps', yearText(), LOOMIS_YEAR);
  expectEq('alternative modules on load', capA(), '44');
  expectEq('original modules on load', capO(), '44');

  // Solstices and equinoxes: Dec 21 is the winter solstice (the default day); an ordinary day has no label.
  expectEq('Dec 21 is labelled the winter solstice', elements.seasonLabel.textContent, 'winter solstice');
  setVal('day', '172'); fire('day', 'change'); flush();
  expectEq('Jun 21 is labelled the summer solstice', elements.seasonLabel.textContent, 'summer solstice');
  setVal('day', '1'); fire('day', 'change'); flush();
  expectEq('an ordinary day has no season label', elements.seasonLabel.textContent, '');
  setVal('day', '355'); fire('day', 'change'); flush();

  // Module size in millimetres and in feet and inches to the sixteenth, on each controls box and in the site box.
  expectEq('module size on the controls: mm, ft/in, and area',
    elements.modO.textContent, 'Module 2100 × 1050 mm (6 ft 10 11/16 in × 3 ft 5 5/16 in), 2.205 m² (23.7 ft²)');
  expectEq('module size in the site box matches', elements.moduleInfo.textContent === elements.modO.textContent, true);

  // Collapsing a view hides it and its controls, so the other view goes full width; the last open view stays open.
  const docClick = id => (docListeners.click || []).forEach(fn => fn({ target: { getAttribute: n => (n === 'data-tog' ? id : null) } }));
  docClick('boxO');
  expectEq('collapsing the original view hides its controls', elements.stage.classList.contains('off-o'), true);
  docClick('boxA');
  expectEq('the last open view stays open', elements.boxA.classList.contains('collapsed'), false);
  docClick('boxO');
  expectEq('expanding the original view shows its controls again', elements.stage.classList.contains('off-o'), false);
  // The stage order: original controls, original view, time, day, alternative view, alternative controls.
  const stageOrder = ['ctrlO', 'boxO', 'boxT', 'boxDay', 'boxA', 'ctrlA'].map(id => html.indexOf('id="' + id + '"'));
  expectEq('the time and date graphs sit between the two renders', stageOrder.every((p, i) => p > 0 && (i === 0 || p > stageOrder[i - 1])), true);

  // Every (i) button in the page has its help text.
  const helpKeys = [...new Set([...html.matchAll(/data-help="(\w+)"/g)].map(m => m[1]))];
  const missingHelp = helpKeys.filter(k => !new RegExp('\\b' + k + ': "').test(script));
  expectEq('every (i) button has help text (' + helpKeys.join(', ') + ')', missingHelp.length, 0);

  // The compass rose: in the default view north points up and to the right of the rose centre, east down and to the right.
  const roseLabels = elements.cO._ctx.__texts || [];
  const lastLabel = t => roseLabels.filter(l => l.text === t).pop();
  const roseX = 40, roseY = 460 - 34;
  expectEq('compass rose: north label up and to the right of the centre',
    lastLabel('N').x > roseX && lastLabel('N').y < roseY, true);
  expectEq('compass rose: east label down and to the right', lastLabel('E').x > roseX && lastLabel('E').y > roseY, true);
  expectEq('compass rose: south label down and to the left', lastLabel('S').x < roseX && lastLabel('S').y > roseY, true);
  expectEq('compass rose: west label up and to the left', lastLabel('W').x < roseX && lastLabel('W').y < roseY, true);

  // Turning true north: a click on the clockwise arrow adds 15 degrees to the offset and redraws every view; the other arrow
  // takes it back; shift-click moves by 1 degree. The offset is saved with the scenario.
  const arrow = (dir, view = 'cO') => elements[view]._roseHits.find(h => h.delta * dir > 0);
  const click = (view, h, shift) => fireEv(view, 'click', { clientX: h.x, clientY: h.y, shiftKey: !!shift });
  click('cO', arrow(1));
  expectEq('clockwise arrow turns true north 15 degrees', elements.trueNorthOffset.value, '15');
  for (let i = 0; i < 5; i++) click('cO', arrow(1));
  flush();
  expectEq('offset 90: the rose N label sits right of and below the centre (true north is graph east)',
    lastLabel('N').x > roseX && lastLabel('N').y > roseY, true);
  expectEq('offset 90: the year totals change', yearText() !== LOOMIS_YEAR, true);
  click('cA', arrow(1, 'cA'));
  expectEq('the arrows on the alternative view turn it too', elements.trueNorthOffset.value, '105');
  for (let i = 0; i < 7; i++) click('cO', arrow(-1));
  flush();
  expectEq('offset back to 0: year totals restored', yearText(), LOOMIS_YEAR);
  click('cO', arrow(1), true);
  expectEq('shift-click moves 1 degree', elements.trueNorthOffset.value, '1');
  click('cO', arrow(-1), true);
  flush();
  expectEq('shift-click back: offset 0 and year totals restored', elements.trueNorthOffset.value + ' ' + yearText(), '0 ' + LOOMIS_YEAR);
  click('cO', arrow(1));
  flush();
  fire('scSave', 'click');
  flush();
  expectEq('the offset is saved with the scenario', /"trueNorthOffset": "15"/.test(elements.scText.value), true);
  click('cO', arrow(-1));
  flush();
  expectEq('offset back to 0 after saving', elements.trueNorthOffset.value, '0');

  // Changing the latitude looks up the zone. A London location changes the clock labels and the year; the default location
  // brings both back.
  mockZone = 'Europe/London';
  setVal('latitude', '51.5'); setVal('longitude', '-0.12'); fire('latitude', 'change'); await tick(); flush();
  expectEq('lookup sends only the two numbers', fetchUrls[fetchUrls.length - 1].includes('latitude=51.5&longitude=-0.12'), true);
  expectEq('lookup result sets the time zone', elements.timeZone.value, 'Europe/London');
  expectEq('lookup result is reported', /Time zone for this location: Europe\/London\./.test(elements.zoneStatus.textContent), true);
  expectEq('London clock label has no PST', /PST/.test(elements.timeLabel.textContent), false);
  expectEq('a different location changes the year totals', yearText() !== LOOMIS_YEAR, true);
  mockZone = 'America/Los_Angeles';
  setVal('latitude', '38.8'); setVal('longitude', '-121.2'); fire('latitude', 'change'); await tick(); flush();
  expectEq('default location restores the zone', elements.timeZone.value, 'America/Los_Angeles');
  expectEq('default location restores the year totals', yearText(), LOOMIS_YEAR);

  // A failed lookup says so and keeps the zone already set.
  mockFail = true;
  setVal('latitude', '45'); fire('latitude', 'change'); await tick(); flush();
  expectEq('failed lookup is reported', /Time zone lookup failed/.test(elements.zoneStatus.textContent), true);
  expectEq('failed lookup keeps the zone', elements.timeZone.value, 'America/Los_Angeles');
  mockFail = false;
  setVal('latitude', '38.8'); fire('latitude', 'change'); await tick(); flush();
  expectEq('back on the default latitude: year totals restored', yearText(), LOOMIS_YEAR);

  // A typed zone changes the clock labels; an unknown one is reported and the default zone is used.
  setVal('timeZone', 'Australia/Sydney'); fire('timeZone', 'change'); flush();
  expectEq('a typed zone changes the clock labels', /PST/.test(elements.timeLabel.textContent), false);
  setVal('timeZone', 'Not/AZone'); fire('timeZone', 'change'); flush();
  expectEq('an unknown zone is reported', /Unknown time zone/.test(elements.zoneStatus.textContent), true);
  expectEq('an unknown zone falls back to the default for the labels', /PST/.test(elements.timeLabel.textContent), true);
  setVal('timeZone', 'America/Los_Angeles'); fire('timeZone', 'change'); flush();
  expectEq('the default zone again: status cleared', elements.zoneStatus.textContent, '');

  // Save: the location and the zone go into the file.
  fire('scSave', 'click');
  flush();
  const savedText = elements.scText.value;
  expectEq('save writes version 7', /"version": 7,/.test(savedText), true);
  expectEq('save keeps the latitude, longitude, and zone in the file',
    /"latitude": "38\.8"/.test(savedText) && /"longitude": "-121\.2"/.test(savedText) &&
    /"timeZone": "America\/Los_Angeles"/.test(savedText), true);
  expectEq('save has no UTC offset or daylight days', /utcOffset|dstStart|dstEnd/.test(savedText), false);
  expectEq('save names the alternative inputs "alternative"', /"alternative": \{/.test(savedText), true);
  expectEq('save names the all-rows move right and up', /"allRight": "0"/.test(savedText) && /"allUp": "0"/.test(savedText), true);
  setVal('rating', '550'); fire('rating', 'change'); flush();
  elements.scText.value = savedText; fire('scLoadText', 'click'); flush();
  expectEq('round trip restores the rating', elements.rating.value, '500');
  expectEq('round trip: no value differs from the saved one', diffCount(), 0);
  setVal('rating', '550'); fire('rating', 'change'); flush();
  expectEq('changed rating: values differ from the saved one', diffCount() > 0, true);
  elements.scText.value = savedText; fire('scLoadText', 'click'); flush();
  expectEq('loaded again: rating restored', elements.rating.value, '500');
  elements.scText.value = 'not a scenario'; fire('scLoadText', 'click');
  expectEq('bad text is refused', elements.scStatus.textContent.indexOf('Could not load') === 0, true);

  // A scenario carries its own location and zone: loading one sets them, and loading does not look anything up.
  const fetchesBefore = fetchUrls.length;
  const otherPlace = savedText.replace('"latitude": "38.8"', '"latitude": "45.5"')
    .replace('"longitude": "-121.2"', '"longitude": "-122.7"')
    .replace('"timeZone": "America/Los_Angeles"', '"timeZone": "America/Denver"');
  expectEq('the saved text holds the location to change', otherPlace !== savedText, true);
  elements.scText.value = otherPlace; fire('scLoadText', 'click'); flush();
  expectEq('loaded scenario sets the latitude', elements.latitude.value, '45.5');
  expectEq('loaded scenario sets the longitude', elements.longitude.value, '-122.7');
  expectEq('loaded scenario sets the time zone', elements.timeZone.value, 'America/Denver');
  expectEq('loading does not look up the zone', fetchUrls.length, fetchesBefore);
  expectEq('loaded scenario changes the year totals', yearText() !== LOOMIS_YEAR, true);
  elements.scText.value = savedText; fire('scLoadText', 'click'); flush();
  expectEq('the saved zone comes back', elements.timeZone.value, 'America/Los_Angeles');
  expectEq('the saved year totals come back', yearText(), LOOMIS_YEAR);

  // Version 5 files kept a UTC offset and daylight days: the Loomis settings map to its zone, and another whole-hour
  // offset maps to a fixed Etc zone.
  loadRaw({ format: 'array-shading-scenario', version: 5, name: 'v5 Loomis', saved: '2026-01-01T00:00:00Z',
    inputs: { site: Object.assign({}, SITE, { latitude: '38.8', longitude: '-121.2', utcOffset: '-8', dstStart: '67', dstEnd: '305' }),
              view: { day: '355', time: '9' } } });
  expectEq('v5 Loomis settings map to Los Angeles', elements.timeZone.value, 'America/Los_Angeles');
  loadRaw({ format: 'array-shading-scenario', version: 5, name: 'v5 fixed', saved: '2026-01-01T00:00:00Z',
    inputs: { site: Object.assign({}, SITE, { latitude: '-33.9', longitude: '151.2', utcOffset: '3', dstStart: '0', dstEnd: '0' }),
              view: { day: '355', time: '9' } } });
  expectEq('v5 whole-hour offset maps to a fixed Etc zone', elements.timeZone.value, 'Etc/GMT-3');
  expectEq('v5 latitude loads', elements.latitude.value, '-33.9');

  // A version 4 file: "proposed" becomes "alternative", and a file without a location takes the default one.
  const v4Old = { format: 'array-shading-scenario', version: 4, name: 'v4 test', saved: '2026-01-01T00:00:00Z',
    inputs: {
      site: SITE, view: { day: '355', time: '9' },
      original: { allDx: '0', allDy: '0', rows: rowsOf(g => ({ on: onOf(g), n: String(N_DEF[g]), base: String(BASE_O[g]), tilt: '45',
        dz: '0', gap: GAP[g], right: String(RIGHT[g]), up: String(UP[g]) })) },
      proposed: { allDx: '0', allDy: '1', rows: rowsOf(g => ({ on: onOf(g), n: String(N_DEF[g]), base: String(BASE_A[g]), tilt: '45',
        dz: '0', gap: GAP[g], right: g === 'OL' ? '2.5' : String(RIGHT[g]), up: String(UP[g]) })) }
    },
    results: { summary: { day: { label: 'Dec 21', N: 355 }, modules: { orig: 44, prop: 44 } }, year: null } };
  loadRaw(v4Old);
  expectEq('v4: time zone defaults when the file has no location', elements.timeZone.value, 'America/Los_Angeles');
  expectEq('v4: "proposed" rows load as the alternative', elements.a_OL_right.value, '2.5');
  expectEq('v4: all-rows up carried over, no sign change', elements.a_all_dy.value, '1');
  expectEq('v4: saved modules compare under the new names',
    /Modules<\/td><td>44<\/td><td>44<\/td><td>44<\/td><td>44<\/td>/.test(elements.cmp.innerHTML), true);

  // A file with no saved results: a note, not an error, and its own location and zone.
  loadRaw({ format: 'array-shading-scenario', version: 6, name: 'no results', saved: '2026-01-01T00:00:00Z',
    inputs: { site: { latitude: '41.9', longitude: '-87.6', timeZone: 'America/Chicago' }, view: { day: '172', time: '12' } } });
  expectEq('no-results file: note instead of an error', /has no saved results/.test(elements.cmp.innerHTML), true);
  expectEq('no-results file: its latitude loads', elements.latitude.value, '41.9');
  expectEq('no-results file: its time zone loads', elements.timeZone.value, 'America/Chicago');
  expectEq('no-results file: other site fields take the defaults', elements.rise.value, '5');
  expectEq('no-results file: day from its view', elements.dateLabel.textContent, 'Jun 21   (day 172 of 365)');
  loadRaw({ format: 'array-shading-scenario', version: 6, name: 'v6 test', saved: '2026-01-01T00:00:00Z',
    inputs: { site: SITE, view: { day: '355', time: '9' } } });
  expectEq('a version 6 file without the offset loads at 0', elements.trueNorthOffset.value, '0');

  // Older layouts: version 1 (gap in feet, positions as shifts from the baseline, north positive) and version 3
  // (top-left positions, measured down). Both land on the baseline locations on graph paper, with the all-rows move.
  const v1 = { format: 'array-shading-scenario', version: 1, name: 'v1 test', saved: '2026-01-01T00:00:00Z',
    inputs: {
      site: SITE, view: { day: '355', time: '9' },
      original: onlySide(rowsOf(g => ({ on: onOf(g), n: String(N_DEF[g]), base: String(BASE_O[g]), tilt: '45', dz: '0',
        gap: String(parseFloat(GAP[g]) / 12), dx: '0', dy: '0' })), { allDx: '0', allDy: '0' }),
      proposed: onlySide(rowsOf(g => ({ on: onOf(g), n: String(N_DEF[g]), base: String(BASE_A[g]), tilt: '45', dz: '0',
        gap: String(parseFloat(GAP[g]) / 12), dx: g === 'OL' ? '2' : '0', dy: g === 'N' ? '3' : '0' })), { allDx: '1', allDy: '4' })
    } };
  loadRaw(v1);
  expectEq('v1: original OL right and up', [elements.o_OL_right.value, elements.o_OL_up.value].join(' '), '0.5 0');
  expectEq('v1: alternative OL right (2 ft shift), all-rows right', [elements.a_OL_right.value, elements.a_all_dx.value].join(' '), '2.5 1');
  expectEq('v1: alternative N up (3 ft shift), all-rows up (4 ft north)', [elements.a_N_up.value, elements.a_all_dy.value].join(' '), '45 4');
  expectEq('v1: OL gap back in inches', parseFloat(elements.a_OL_gap.value).toFixed(3), '10.068');

  const v3Side = (base, allDy) => ({
    rows: rowsOf(g => ({ on: onOf(g), n: String(N_DEF[g]), base: String(base[g]), tilt: '45', dz: '0', gap: GAP[g],
      left: String(LEFT3[g]), down: String(DOWN3[g]) })),
    allDx: '0', allDy: allDy });
  const v3File = allDy => ({ format: 'array-shading-scenario', version: 3, name: 'v3 test', saved: '2026-01-01T00:00:00Z',
    inputs: { site: SITE, view: { day: '355', time: '9' }, original: v3Side(BASE_O, '0'), proposed: v3Side(BASE_A, allDy) } });
  loadRaw(v3File('0'));
  expectEq('v3: OL right and up', [elements.a_OL_right.value, elements.a_OL_up.value].join(' '), '0.5 0');
  expectEq('v3: IL right and up', [elements.a_IL_right.value, elements.a_IL_up.value].join(' '), '12.9 8');
  expectEq('v3: IR right and up', [elements.a_IR_right.value, elements.a_IR_up.value].join(' '), '24.1 8');
  expectEq('v3: OR right and up (original)', [elements.o_OR_right.value, elements.o_OR_up.value].join(' '), '36.2 0');
  expectEq('v3: north row right and up', [elements.a_N_right.value, elements.a_N_up.value].join(' '), '10 42');
  expectEq('v3: inner north and south rows up', [elements.a_NI_up.value, elements.a_SI_up.value].join(' '), '30 12');
  expectEq('v3: south row up', elements.a_S_up.value, '0');
  flush();
  expectEq('v3 at the baseline: year totals match the defaults', yearText(), LOOMIS_YEAR);
  loadRaw(v3File('2'));
  expectEq('v3: all-rows up is the negative of the down value', elements.a_all_dy.value, '-2');
  loadRaw(v3File('0'));
  expectEq('v3 back to the baseline: all-rows up is zero', elements.a_all_dy.value, '0');

  // Clock and day sliders.
  setVal('time', '15'); fire('time', 'input');
  expectEq('clock slider at 3 pm (drag)', /^3:00 pm PST /.test(elements.timeLabel.textContent), true);
  fire('time', 'change');
  setVal('time', '6'); fire('time', 'input');
  expectEq('clock slider at its top, 6 am', /^6:00 am PST /.test(elements.timeLabel.textContent), true);
  setVal('time', '21'); fire('time', 'input'); fire('time', 'change');
  expectEq('clock slider at its bottom, 9 pm', /^9:00 pm PST /.test(elements.timeLabel.textContent), true);
  setVal('time', '9'); fire('time', 'input');
  setVal('day', '1'); fire('day', 'input');
  expectEq('day slider at Jan 1', elements.dateLabel.textContent, 'Jan 1   (day 1 of 365)');
  setVal('day', '172'); fire('day', 'input'); fire('day', 'change');
  expectEq('day slider at Jun 21', elements.dateLabel.textContent, 'Jun 21   (day 172 of 365)');
  expectEq('Jun 21 summary header', (elements.sum.innerHTML.match(/<th>([^<]*summary)<\/th>/) || [])[1], 'Jun 21 summary');
  expectEq('Jun 21 clock label is PDT', /^9:00 am PDT /.test(elements.timeLabel.textContent), true);
  setVal('day', '365'); fire('day', 'input'); fire('day', 'change');
  expectEq('day slider at Dec 31', elements.dateLabel.textContent, 'Dec 31   (day 365 of 365)');
  setVal('day', '355'); fire('day', 'change');

  // Per-row settings: On boxes, panels, base, height difference, and the extra inner rows.
  setChk('a_N_on', false); fire('knobsA', 'change');
  expectEq('north row off: alternative modules', capA(), '39');
  setChk('a_N_on', true); setVal('a_N_dz', '2'); fire('knobsA', 'change');
  expectEq('north row on, height difference 2: alternative modules', capA(), '44');
  setVal('a_IL_base', '7'); fire('knobsA', 'change');
  expectEq('inner west row base 7: at least its 7 modules over the cap',
    Number(summaryRow('Modules over the').alternative) >= 7, true);
  setVal('a_IL_base', '5'); fire('knobsA', 'change');
  setVal('a_OL_n', '12'); fire('knobsA', 'change');
  expectEq('outer west row with 12 panels: alternative modules', capA(), '46');
  setVal('a_OL_n', '10'); fire('knobsA', 'change');
  setChk('a_NI_on', true); fire('knobsA', 'change');
  expectEq('inner north row on: alternative modules', capA(), '49');
  setChk('a_SI_on', true); fire('knobsA', 'change');
  expectEq('inner south row on as well: alternative modules', capA(), '54');
  setChk('a_NI_on', false); setChk('a_SI_on', false); fire('knobsA', 'change');
  expectEq('extra rows off again: alternative modules', capA(), '44');

  // Positions from 0,0: moving the outer west row, then every row with the all-rows control.
  flush();
  const yBefore = yearText();
  setVal('a_OL_right', '3.5'); fire('knobsA', 'change'); flush();
  expectEq('outer west row 3 ft east: year total changes', yearText() !== yBefore, true);
  setVal('a_OL_right', '0.5'); fire('knobsA', 'change'); flush();
  expectEq('outer west row back at its baseline: year total restored', yearText(), yBefore);
  setVal('a_all_dx', '2'); fire('knobsA', 'change'); flush();
  expectEq('all rows 2 ft east: year total changes', yearText() !== yBefore, true);
  setVal('a_all_dx', '0'); fire('knobsA', 'change'); flush();
  expectEq('all rows back: year total restored', yearText(), yBefore);
  expectEq('group rows in the table (header plus 8)', (elements.grp.innerHTML.match(/<tr>/g) || []).length, 9);

  // Original side and the cap measurement.
  setVal('o_OR_tilt', '30'); fire('knobsO', 'change');
  expectEq('original outer east row at 30 degrees: original modules', capO(), '44');
  setVal('meas', 'lowest'); fire('meas', 'change');
  expectEq('cap from the lowest grade: both sides have a count',
    /^\d+$/.test(summaryRow('Modules over the').original) && /^\d+$/.test(summaryRow('Modules over the').alternative), true);
  setVal('meas', 'local'); fire('meas', 'change');
  setVal('wallh', '0'); fire('wallh', 'change');
  expectEq('wall off: alternative modules unchanged', capA(), '44');
  expectEq('summary table: header plus 9 rows', (elements.sum.innerHTML.match(/<tr>/g) || []).length, 10);

  // The plan label, the 5 am start, the strip with each time's plan render above its alternative render, and the graph.
  expectEq('the plan view is titled Plan', elements.capO.textContent.startsWith('Plan: '), true);
  expectEq('the time cursor runs from 5 am to 9 pm', /id="time" type="range" min="5" max="21"/.test(html), true);
  expectEq('the time graph labels every four hours from 5 am to 9 pm',
    ['5 am', '9 am', '1 pm', '5 pm', '9 pm'].every(n => elements.gr._ctx.__texts.some(t => t.text === n)), true);
  expectEq('each time pairs the plan render above the alternative render',
    [0, 1, 2, 3, 4].every(k => new RegExp('<div class="pair"><canvas id="o' + k + '"[^>]*><\\/canvas><canvas id="a' + k + '"').test(html)), true);
  expectEq('the graph title names the layout and the day total',
    /^Projected output, kW · Plan · day total [\d.]+ kWh$/.test(elements.grTitle.textContent), true);
  expectEq('the graph day total matches the summary', /day total ([\d.]+) kWh/.exec(elements.grTitle.textContent)[1],
    summaryRow('Day: estimated output').original);
  expectEq('the use line waits for imported data', elements.grUse.textContent, 'use, kW: not imported yet');
  expectEq('the graph is labelled on the slider scale', elements.gr._ctx.__texts.some(t => t.text === '1 pm'), true);
  fire('grAlt', 'click');
  expectEq('the graph switches to the alternative',
    /· Alternative · day total/.test(elements.grTitle.textContent) && elements.grAlt.classList.contains('on') && !elements.grPlan.classList.contains('on'), true);
  fire('grPlan', 'click');
  expectEq('and back to the plan', /· Plan · day total/.test(elements.grTitle.textContent) && elements.grPlan.classList.contains('on'), true);

  // The date card's month graph: in the day card, with the year total in its title (the same number as the year label), the
  // month names under it, and the same Plan/Alternative switch as the time graph.
  flush();   // the yearly steps finish first: until then both the title and the year label read "…"
  const dgYear = /year ([\d,]+) kWh/.exec(elements.dgTitle.textContent), yrPlan = /plan ([\d,]+)/.exec(yearText());
  expectEq('the date graph title names the layout and matches the year label',
    /^Projected output by month, kWh · Plan · year [\d,]+ kWh$/.test(elements.dgTitle.textContent) && !!dgYear && !!yrPlan && dgYear[1] === yrPlan[1], true);
  expectEq('the date graph sits in the day card, after its slider and labels',
    html.indexOf('id="dg"') > html.indexOf('id="boxDay"') && html.indexOf('id="dg"') < html.indexOf('id="boxA"'), true);
  expectEq('the date graph names the months', ['Jan', 'Jun', 'Dec'].every(n => elements.dg._ctx.__texts.some(t => t.text === n)), true);
  fire('dgAlt', 'click');
  expectEq('the date graph switches to the alternative, and so does the time graph',
    /· Alternative · year/.test(elements.dgTitle.textContent) && elements.dgAlt.classList.contains('on') && elements.grAlt.classList.contains('on'), true);
  fire('dgPlan', 'click');
  expectEq('and back to the plan on both graphs', /· Plan · year/.test(elements.dgTitle.textContent) && elements.grPlan.classList.contains('on'), true);

  // Use data: a pasted file, read by the same parser as the file picker. Sep 20 and Sep 21, 2026 are complete at 0.5 kWh a
  // reading; Sep 22 has 10 readings; the gas row is not used. So the file has 3 days, 2 of them complete, and 101.0 kWh.
  const usePoint = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const useLines = (day, n) => Array.from({ length: n }, (_, i) =>
    ['Electric usage', day, usePoint(i * 15), usePoint(i * 15 + 14), '0.50', '$0.10'].join(','));
  setVal('useText', ['TYPE,DATE,START TIME,END TIME,USAGE (kWh),COST,NOTES', ...useLines('2026-09-20', 96),
    ...useLines('2026-09-21', 96), ...useLines('2026-09-22', 10), 'Natural gas usage,2026-09-20,00:00,23:59,3.00,$1.00,'].join('\n'));
  fire('useLoadText', 'click'); flush();
  expectEq('use file: days, complete days, and total in the status',
    /Loaded the usage file: 3 days, Sep 20, 2026 to Sep 22, 2026, 2 complete, 101\.0 kWh\./.test(elements.useStatus.textContent), true);
  expectEq('use file: the day slider moves to the last complete day', elements.dateLabel.textContent.startsWith('Sep 21'), true);
  const useTitle = elements.grTitle.textContent, useOut = parseFloat(/day total ([\d.]+) kWh/.exec(useTitle)[1]);
  const useNet = /net ([+−])(\d+\.\d) kWh/.exec(useTitle);
  expectEq('use line: 48.0 kWh on the day, with its net', /· use 48\.0 kWh · net [+−]\d+\.\d kWh/.test(useTitle), true);
  expectEq('the net is the use minus the output for the day',
    !!useNet && Math.abs((useNet[1] === '+' ? 1 : -1) * parseFloat(useNet[2]) - (48 - useOut)) < 0.11, true);
  // The battery for net zero: with a flat 0.50 kWh a quarter hour and no output at night, the largest shortfall is 2.0 kW.
  expectEq('the projected output line gives the battery for net zero: peak discharge and storage',
    /battery for net zero: peak discharge 2\.0 kW, storage [\d.]+ kWh/.test(elements.grTitle.textContent), true);
  expectEq('use legend: no full month in the file yet', elements.dgUse.textContent, 'use, kWh: no full month in the file yet');
  // Hovering the time graph's line: the quarter hour under the cursor, in kWh and kW. The stub maps x to the drawing one for one.
  const timeX = t => 8 + (t - 5) / 16 * (640 - 16);
  fireEv('gr', 'pointermove', { clientX: timeX(10.0), clientY: 60 });
  expectEq('hovering the time graph gives the output and the use in kWh per 15 min',
    /Plan output [\d.]+ kWh per 15 min \([\d.]+ kW\)/.test(elements.tip.innerHTML) &&
    /Use 0\.50 kWh per 15 min \(2\.00 kW\)/.test(elements.tip.innerHTML), true);
  fireEv('gr', 'pointerleave', {});
  expectEq('leaving the time graph hides the tip', elements.tip.style.display, 'none');
  setVal('day', '265'); fire('day', 'change'); flush();   // Sep 22, 10 readings
  expectEq('a partial day shows its use, with no net', /· use 5\.0 kWh \(partial day\)/.test(elements.grTitle.textContent), true);
  expectEq('a partial day has no battery figure', /battery/.test(elements.grTitle.textContent), false);
  setVal('day', '263'); fire('day', 'change'); flush();   // Sep 20
  const useOut20 = parseFloat(/day total ([\d.]+) kWh/.exec(elements.grTitle.textContent)[1]);
  setVal('day', '264'); fire('day', 'change'); flush();   // Sep 21
  const useOut21 = parseFloat(/day total ([\d.]+) kWh/.exec(elements.grTitle.textContent)[1]);
  const planOut = /Output, kWh \(clear sky\)<\/td><td>([\d.]+)<\/td>/.exec(elements.useSum.innerHTML);
  expectEq('use summary: 2 complete days, whose output is the two day totals',
    /Complete days in the file: 2 of 3/.test(elements.useSum.innerHTML) && !!planOut && Math.abs(parseFloat(planOut[1]) - (useOut20 + useOut21)) < 0.15, true);
  fire('useClear', 'click');
  expectEq('clearing the file removes the summary, the status, and the use line',
    elements.useSum.innerHTML === '' && elements.useStatus.textContent === '' && !/· use /.test(elements.grTitle.textContent), true);

  // A full month in the file: November 2026, 30 days at 0.5 kWh a reading (1,440.0 kWh). Its use goes in the monthly table with
  // the year's output for November, which is the figure on the date graph's monthly label.
  const novLines = [];
  for (let d = 1; d <= 30; d++) for (let i = 0; i < 96; i++) {
    novLines.push(['Electric usage', '2026-11-' + String(d).padStart(2, '0'), usePoint(i * 15), usePoint(i * 15 + 14), '0.50', '$0.10'].join(','));
  }
  setVal('useText', ['TYPE,DATE,START TIME,END TIME,USAGE (kWh),COST,NOTES', ...novLines].join('\n'));
  fire('useLoadText', 'click'); flush();
  expectEq('a full month: all 30 days are complete', /Complete days in the file: 30 of 30/.test(elements.useSum.innerHTML), true);
  const novRow = /<td>Nov 2026<\/td><td>1440\.0<\/td><td>([\d.]+)<\/td>/.exec(elements.useSum.innerHTML);
  expectEq('a full month: its use is in the monthly table', !!novRow, true);
  const novLabel = [...(elements.dg._ctx.__texts || [])].map(t => t.text).filter(t => /^Plan Nov: /.test(t)).pop() || '';
  const novGraph = /^Plan Nov: ([\d,]+) kWh/.exec(novLabel);
  expectEq('the monthly output matches the date graph label',
    !!novRow && !!novGraph && Math.abs(parseFloat(novGraph[1].replace(/,/g, '')) - Math.round(parseFloat(novRow[1]))) <= 1, true);
  expectEq('the date graph has the monthly use line', elements.dgUse.textContent, 'use, kWh per month: from the use file');
  // Hovering the date graph's line: the month under the cursor, with its output and its use, in kWh.
  const dateX = n => 8 + (n - 1) / 364 * (640 - 16);
  fireEv('dg', 'pointermove', { clientX: dateX(319), clientY: 60 });   // Nov 15
  expectEq('hovering the date graph gives the month, its output and its use in kWh',
    /<b>Nov<\/b><br>Plan output [\d,]+ kWh<br>Use 1,440 kWh/.test(elements.tip.innerHTML), true);
  fire('useClear', 'click');

  // Dragging the cursor on a graph: the time graph sets the clock time to the quarter hour, the date graph sets the day. The stub
  // maps x to the drawing one for one, on a 640-wide canvas with the 8 px margin.
  const cursorX = (lo, hi, v) => 8 + (v - lo) / (hi - lo) * (640 - 16);
  fireEv('gr', 'pointerdown', { clientX: cursorX(5, 21, 10), clientY: 60, pointerId: 1 });
  fireEv('gr', 'pointermove', { clientX: cursorX(5, 21, 14.25), clientY: 60, pointerId: 1 });
  fireEv('gr', 'pointerup', { clientX: cursorX(5, 21, 14.25), clientY: 60, pointerId: 1 });
  expectEq('dragging the time cursor sets the clock to the quarter hour', elements.time.value, '14.25');
  fireEv('dg', 'pointerdown', { clientX: cursorX(1, 365, 200), clientY: 60, pointerId: 1 });
  fireEv('dg', 'pointerup', { clientX: cursorX(1, 365, 200), clientY: 60, pointerId: 1 });
  expectEq('dragging the date cursor sets the day', elements.day.value, '200');
  setVal('time', '9'); setVal('day', '355'); fire('day', 'change'); flush();

  // Dragging a row: press on the front-most module and move the pointer across the ground. The row's right and up follow the
  // pointer to 0.1 ft, and moving back returns them.
  const nearestHit = elements.cO._hits.reduce((a, b) => (b.z < a.z ? b : a));
  const dragGroup = nearestHit.group, rIn = elements['o_' + dragGroup + '_right'], uIn = elements['o_' + dragGroup + '_up'];
  const mid = nearestHit.pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const r0 = rIn.value, u0 = uIn.value;
  fireEv('cO', 'pointerdown', { clientX: mid[0], clientY: mid[1], pointerId: 1 });
  fireEv('cO', 'pointermove', { clientX: mid[0] + 25, clientY: mid[1] - 12, pointerId: 1 });
  expectEq('dragging a module moves its row (' + dragGroup + ')', rIn.value !== r0 || uIn.value !== u0, true);
  expectEq('the dragged values are to 0.1 ft', [rIn.value, uIn.value].every(v => /^-?\d+(\.\d)?$/.test(v)), true);
  fireEv('cO', 'pointermove', { clientX: mid[0], clientY: mid[1], pointerId: 1 });
  fireEv('cO', 'pointerup', { clientX: mid[0], clientY: mid[1], pointerId: 1 });
  expectEq('moving back returns the row to where it was', rIn.value === r0 && uIn.value === u0, true);

  console.log(fails ? fails + ' check(s) failed' : 'all checks passed');
  process.exitCode = fails ? 1 : 0;
  console.log('done');
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
