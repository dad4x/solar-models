// Dragging a row on the plan view.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush, yearText,
  summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw, LOOMIS_YEAR,
  ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state } = P;
(async () => {
  P.runPage(); flush();
  setVal('a_N_dz', '2'); fire('knobsA', 'change');
  setVal('o_OR_tilt', '30'); fire('knobsO', 'change'); setVal('wallh', '0'); fire('wallh', 'change'); flush();
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

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
