// Per-row settings, the add row and add column buttons, and the positions of the rows.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, docListeners, fetchUrls, html, script, ctx, vm, expectEq, fire, fireEv, setVal, setChk, tick, flush, yearText,
  summaryRow, diffCount, capO, capA, onlySide, rowsOf, rowOn, rowFolded, checkedRows, scenarioOf, SITE, loadRaw, LOOMIS_YEAR,
  ROWS, DNS, N_DEF, GAP, BASE_O, BASE_A, RIGHT, UP, LEFT3, DOWN3, onOf, state } = P;
(async () => {
  P.runPage(); flush();
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

  // Add row and Add column. A row runs east-west and the four rows stack north to south (N, NI, SI, S). A column runs
  // north-south and the four columns sit side by side (OL, IL, IR, OR). A spare one is off. Each button switches on the next
  // spare one of its kind and opens its box; ticking or unticking a row's On box opens or folds its box the same way.
  ROWS.forEach(g => rowOn('o_', g, onOf(g)));
  expectEq('plan: Add column greyed out while all four columns are on', elements.addColO.disabled, true);
  expectEq('plan: Add row available while an inner north or south row is off', elements.addRowO.disabled, false);
  expectEq('alternative: Add column greyed out while all four columns are on', elements.addColA.disabled, true);
  expectEq('alternative: Add row available while an inner north or south row is off', elements.addRowA.disabled, false);
  expectEq('the inner north row starts folded', rowFolded('o_', 'NI'), true);
  rowOn('o_', 'NI', true);
  expectEq('ticking an inner row opens its box', rowFolded('o_', 'NI'), false);
  rowOn('o_', 'NI', false);
  expectEq('unticking it folds the box again', rowFolded('o_', 'NI'), true);

  fire('addRowO', 'click');
  expectEq('Add row switches on the first off row, the inner north', elements.o_NI_on.checked, true);
  expectEq('... and opens its box', rowFolded('o_', 'NI'), false);
  expectEq('the inner south row is still spare, so Add row stays available', elements.addRowO.disabled, false);
  fire('addRowO', 'click');
  expectEq('the next Add row switches on the inner south row', elements.o_SI_on.checked, true);
  expectEq('the extra north rows come next, so Add row stays available', elements.addRowO.disabled, false);
  fire('addRowO', 'click');
  expectEq('the first extra north row, nearest the north row, is next', elements.o_X1_on.checked, true);
  expectEq('... and opens its box', rowFolded('o_', 'X1'), false);
  for (let k = 0; k < 3; k++) fire('addRowO', 'click');
  expectEq('the fourth extra north row switches on last', elements.o_X4_on.checked, true);
  expectEq('with all eight rows on, Add row is greyed out', elements.addRowO.disabled, true);
  expectEq('plan: the eight rows and four columns on make 74 modules (34 + 40)', capO(), '74');
  const onBeforeClick = checkedRows('o_');
  fire('addRowO', 'click');
  expectEq('clicking a greyed-out Add row changes nothing', checkedRows('o_'), onBeforeClick);

  expectEq('Add column still greyed out while all four columns are on', elements.addColO.disabled, true);
  rowOn('o_', 'OL', false); rowOn('o_', 'IR', false);
  expectEq('an off column makes Add column available', elements.addColO.disabled, false);
  expectEq('the switched-off outer west column folds away', rowFolded('o_', 'OL'), true);
  fire('addColO', 'click');
  expectEq('Add column switches on the first off column, the outer west', elements.o_OL_on.checked, true);
  expectEq('... and opens its box', rowFolded('o_', 'OL'), false);
  expectEq('the inner east column is still spare, so Add column stays available', elements.addColO.disabled, false);
  fire('addColO', 'click');
  expectEq('the next Add column switches on the inner east column', elements.o_IR_on.checked, true);
  expectEq('with all four columns on again, Add column is greyed out', elements.addColO.disabled, true);

  // A saved scenario sets the On boxes on load, and each row's box follows its On box: a row on in the file opens, and one off folds.
  // Saving waits for the yearly totals after a change, so each change is flushed before the save, and the saved text is checked.
  rowOn('o_', 'NI', true); flush();
  fire('scSave', 'click'); flush();
  const innerOn = elements.scText.value;
  expectEq('the file saved with the inner north row on has it on', scenarioOf(innerOn).inputs.original.rows.NI.on, true);
  rowOn('o_', 'NI', false); flush();
  elements.scText.value = innerOn; fire('scLoadText', 'click'); flush();
  expectEq('loading a file with the inner north row on ticks it', elements.o_NI_on.checked, true);
  expectEq('the loaded inner north row opens its box', rowFolded('o_', 'NI'), false);
  rowOn('o_', 'NI', false); flush();
  fire('scSave', 'click'); flush();
  const innerOff = elements.scText.value;
  expectEq('the file saved with it off has the inner north row off', scenarioOf(innerOff).inputs.original.rows.NI.on, false);
  rowOn('o_', 'NI', true); flush();
  elements.scText.value = innerOff; fire('scLoadText', 'click'); flush();
  expectEq('loading a file with the inner north row off unticks it', elements.o_NI_on.checked, false);
  expectEq('the loaded inner north row folds its box', rowFolded('o_', 'NI'), true);

  // Back to the default rows for the checks after this.
  ROWS.forEach(g => rowOn('o_', g, onOf(g)));
  expectEq('default rows again: Add column greyed out', elements.addColO.disabled, true);
  expectEq('default rows again: Add row available', elements.addRowO.disabled, false);

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
  expectEq('group rows in the table (header plus 12)', (elements.grp.innerHTML.match(/<tr>/g) || []).length, 13);

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
