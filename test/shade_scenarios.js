// Scenario files: the location they carry, the older versions, and the clock and day sliders.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush, yearText,
  summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw, LOOMIS_YEAR,
  ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state } = P;
(async () => {
  P.runPage(); flush();
  fire('scSave', 'click'); flush();
  const savedText = elements.scText.value;
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

  // The loaded scenario's name is the name for the next save; a file with no name leaves the name as it is.
  loadRaw({ format: 'array-shading-scenario', version: 7, name: 'south-5-row-8', saved: '2026-10-19T04:25:16.880Z',
    inputs: { site: SITE, view: { day: '355', time: '9' } } });
  expectEq('a loaded scenario names the next save', elements.scName.value, 'south-5-row-8');
  fire('scSave', 'click'); flush();
  expectEq('the next save carries the loaded name in the file and its header',
    /"name": "south-5-row-8"/.test(elements.scText.value) && /Array shading scenario "south-5-row-8"/.test(elements.scText.value), true);
  elements.scName.value = 'Mine';
  loadRaw({ format: 'array-shading-scenario', version: 6, saved: '2026-01-01T00:00:00Z',
    inputs: { site: SITE, view: { day: '355', time: '9' } } });
  expectEq('a file with no name leaves the name as it is', elements.scName.value, 'Mine');

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
