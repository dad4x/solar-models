// The original side and the cap, the plan and alternative graphs, and the date card.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush, yearText,
  summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw, LOOMIS_YEAR,
  ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state } = P;
(async () => {
  P.runPage(); flush();
  setVal('a_N_dz', '2'); fire('knobsA', 'change'); flush();
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

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
