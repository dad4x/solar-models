// The first checks: the page on load, the rose, true north, the location and zone lookups, and a save round trip.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush, yearText,
  summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw, LOOMIS_YEAR,
  ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state } = P;
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
  expectEq('the graph help has colour chips, and explains the battery line and its charge',
    /<i class='sw' style='background:#8e44ad'><\/i> the battery, under the battery limits/.test(script) && /dotted/.test(script), true);

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
  state.mockZone = 'Europe/London';
  setVal('latitude', '51.5'); setVal('longitude', '-0.12'); fire('latitude', 'change'); await tick(); flush();
  expectEq('lookup sends only the two numbers', fetchUrls[fetchUrls.length - 1].includes('latitude=51.5&longitude=-0.12'), true);
  expectEq('lookup result sets the time zone', elements.timeZone.value, 'Europe/London');
  expectEq('lookup result is reported', /Time zone for this location: Europe\/London\./.test(elements.zoneStatus.textContent), true);
  expectEq('London clock label has no PST', /PST/.test(elements.timeLabel.textContent), false);
  expectEq('a different location changes the year totals', yearText() !== LOOMIS_YEAR, true);
  state.mockZone = 'America/Los_Angeles';
  setVal('latitude', '38.8'); setVal('longitude', '-121.2'); fire('latitude', 'change'); await tick(); flush();
  expectEq('default location restores the zone', elements.timeZone.value, 'America/Los_Angeles');
  expectEq('default location restores the year totals', yearText(), LOOMIS_YEAR);

  // A failed lookup says so and keeps the zone already set.
  state.mockFail = true;
  setVal('latitude', '45'); fire('latitude', 'change'); await tick(); flush();
  expectEq('failed lookup is reported', /Time zone lookup failed/.test(elements.zoneStatus.textContent), true);
  expectEq('failed lookup keeps the zone', elements.timeZone.value, 'America/Los_Angeles');
  state.mockFail = false;
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

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
