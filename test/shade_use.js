// Use data and the battery, the hovers, and the cursor drags on the graphs.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush, yearText,
  summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw, LOOMIS_YEAR,
  ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state } = P;
(async () => {
  P.runPage(); flush();
  setVal('a_N_dz', '2'); fire('knobsA', 'change');
  setVal('o_OR_tilt', '30'); fire('knobsO', 'change'); setVal('wallh', '0'); fire('wallh', 'change'); flush();
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
  // The battery's quarter hours on the time graph, for the complete day: a discharge and a net grid flow for each of the 96
  // quarter hours. The net goes below zero where the surplus is exported after the battery charges.
  const battDay = elements.gr._hover;
  expectEq('the time graph carries the battery discharge and net for each quarter hour of the complete day',
    battDay.dis.length === 96 && battDay.net.length === 96, true);
  expectEq('the battery discharges in the night hours, from the charge it took the day before', battDay.dis.some(p => p.kw > 0), true);
  expectEq('the net goes below zero where the surplus is exported after charging', battDay.net.some(p => p.kw < 0), true);
  expectEq('the time graph legend names the battery and the net grid', /battery, kW[\s\S]*net grid, kW/.test(html), true);
  expectEq('the time graph legend names the battery charge line', /battery charge, % of usable/.test(html), true);
  expectEq('the battery charge runs from 0 to full on the day graph',
    battDay.soc.length === 96 && battDay.soc.every(p => p.frac >= 0 && p.frac <= 1.0001) && battDay.soc.some(p => p.frac > 0.1), true);
  expectEq('the day graph marks full charge on the nominal 20 kW line', elements.gr._ctx.__texts.some(t => t.text === '20 kW / 100% charge'), true);
  expectEq('the time graph labels the battery and the grid at its zero line',
    ['battery discharge', 'battery charge', 'grid import', 'grid export'].every(w => elements.gr._ctx.__texts.some(t => t.text === w)), true);
  expectEq('the battery line is positive while it discharges and negative while it charges',
    battDay.bat.some(p => p.kw > 0) && battDay.bat.some(p => p.kw < 0), true);
  expectEq('use legend: no full month in the file yet', elements.dgUse.textContent, 'use, kWh: no full month in the file yet');
  // Hovering the time graph's line: the quarter hour under the cursor, in kWh and kW. The stub maps x to the drawing one for one.
  const timeX = t => 8 + (t - 5) / 16 * (640 - 16);
  fireEv('gr', 'pointermove', { clientX: timeX(10.0), clientY: 60 });
  expectEq('hovering the time graph gives the output and the use in kWh per 15 min',
    /Plan output [\d.]+ kWh per 15 min \([\d.]+ kW\)/.test(elements.tip.innerHTML) &&
    /Use 0\.50 kWh per 15 min \(2\.00 kW\)/.test(elements.tip.innerHTML), true);
  expectEq('hovering the time graph also gives the battery discharge and the net grid for the quarter hour',
    /Battery (discharging|charging|idle)/.test(elements.tip.innerHTML) &&
    /Net grid [+−][\d.]+ kWh per 15 min \((import|export)\)/.test(elements.tip.innerHTML), true);
  expectEq('hovering the time graph gives the battery charge as a share of usable', /Battery charge \d+% of usable/.test(elements.tip.innerHTML), true);
  fireEv('gr', 'pointerleave', {});
  expectEq('leaving the time graph hides the tip', elements.tip.style.display, 'none');
  setVal('day', '265'); fire('day', 'change'); flush();   // Sep 22, 10 readings
  expectEq('a partial day shows its use, with no net', /· use 5\.0 kWh \(partial day\)/.test(elements.grTitle.textContent), true);
  expectEq('a partial day has no battery figure', /battery/.test(elements.grTitle.textContent), false);
  expectEq('a partial day has no battery lines', elements.gr._hover.dis.length + elements.gr._hover.net.length, 0);
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
  // The date graph's battery months: the discharge, and the net with the battery, for each complete month (one here).
  expectEq('the date graph carries the battery discharge and net for the full month',
    elements.dg._hover.dis.length === 1 && elements.dg._hover.net.length === 1, true);
  expectEq('the date legend names the battery discharge and the net with it', /battery discharged to the house, kWh per month[\s\S]*net with battery, kWh per month/.test(html), true);
  expectEq('the date graph labels the battery and the grid at its zero line',
    ['battery discharged', 'grid import', 'grid export'].every(w => elements.dg._ctx.__texts.some(t => t.text === w)), true);
  expectEq('the date graph lines run to Dec 31, the right edge of the year', elements.dg._ctx.__pts.some(p => p.x >= 630), true);
  // The year's battery rows: a flat 2.0 kW use with no output at night has a worst quarter hour of 2.0 kW, for both layouts.
  expectEq('the year battery: a worst quarter hour of 2.0 kW for both layouts',
    /Battery peak discharge, kW \(worst quarter hour\)<\/td><td>2\.0<\/td><td>2\.0<\/td>/.test(elements.useSum.innerHTML), true);
  expectEq('the monthly table gives the November battery: 2.0 kW worst quarter hour, and a storage for each layout',
    /<td>Nov 2026<\/td>(?:<td>[^<]*<\/td>){5}<td>2\.0<\/td><td>[\d.]+<\/td><td>2\.0<\/td><td>[\d.]+<\/td>/.test(elements.useSum.innerHTML), true);
  expectEq('the year battery: a storage figure for each layout',
    /Battery storage, kWh \(worst day\)<\/td><td>[\d.]+<\/td><td>[\d.]+<\/td>/.test(elements.useSum.innerHTML), true);
  // The battery limits: with no battery the net with it is the net without one; a battery cuts the grid import; the day line and
  // the time graph title carry the day's net with the battery.
  const batNet = () => /Net with battery, kWh[^<]*<\/td><td>([+−][\d.]+)<\/td>/.exec(elements.useSum.innerHTML)[1];
  const batNetNone = () => /Net without battery, kWh<\/td><td>([+−][\d.]+)<\/td>/.exec(elements.useSum.innerHTML)[1];
  const batImport = () => parseFloat(/Grid import, kWh<\/td><td>([\d.]+)<\/td>/.exec(elements.useSum.innerHTML)[1]);
  expectEq('the battery table shows its limits',
    /With the battery \(60 kWh usable, 10 kW discharge, 10 kW charge, 90% round trip\)/.test(elements.useSum.innerHTML), true);
  setVal('batKwh', '0'); fire('batKwh', 'change'); flush();
  expectEq('no battery: the net with the battery is the net without one', batNet(), batNetNone());
  expectEq('no battery: the discharge line is zero', elements.gr._hover.dis.every(p => p.kw === 0), true);
  const importNone = batImport();
  setVal('batKwh', '60'); fire('batKwh', 'change'); flush();
  expectEq('a battery cuts the grid import', batImport() <= importNone, true);
  expectEq('the day line gives the net with the battery', /with the battery: net [+−][\d.]+ kWh plan/.test(elements.useSum.innerHTML), true);
  expectEq('the time graph title gives the day net with the battery', /with battery, net [+−]\d+\.\d kWh/.test(elements.grTitle.textContent), true);
  // The net line adds up to the day's net with the battery in the title, to the title's rounding.
  const titleNet = Number(/with battery, net ([+−]?[\d.]+) kWh/.exec(elements.grTitle.textContent)[1].replace('−', '-'));
  const lineNet = elements.gr._hover.net.reduce((a, p) => a + p.kw * 0.25, 0);
  expectEq('the net line adds up to the day net with the battery in the title', Math.abs(titleNet - lineNet) < 0.06, true);
  expectEq('the date graph has the monthly use line', elements.dgUse.textContent.startsWith('use, kWh per month: from the use file'), true);
  // Hovering the date graph's line: the month under the cursor, with its output and its use, in kWh.
  const dateX = n => 8 + (n - 1) / 364 * (640 - 16);
  fireEv('dg', 'pointermove', { clientX: dateX(319), clientY: 60 });   // Nov 15
  expectEq('hovering the date graph gives the month, its output and its use in kWh',
    /<b>Nov<\/b><br>Plan output [\d,]+ kWh<br>Use 1,440 kWh/.test(elements.tip.innerHTML), true);
  expectEq("hovering the date graph also gives the month's battery discharge and its net with the battery",
    /Battery discharged [\d,]+ kWh<br>Battery charged [\d,]+ kWh<br>Net with battery [+−][\d,]+ kWh/.test(elements.tip.innerHTML), true);
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

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
