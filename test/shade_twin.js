// Rows tilted as a unit: the Rows control on a north or south row sets how many rows the row has, 1 to 8. Each further row of the same
// panels sits up the tilt from the one before, sharing the tilt and the height difference. The scenario file carries the count; a
// file from before the control loads the row as one row (or two, for the checkbox that came before). A part of the render page
// checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, ctx, expectEq, fire, fireEv, flush, yearText, LOOMIS_YEAR, scenarioOf, loadRaw } = P;
(async () => {
  P.runPage(); flush();
  expectEq('the plan starts with 44 modules, one row each', elements.capO.textContent, 'Plan: 44 modules');

  // The geometry, from the core: a north row of five panels, with 1 to 8 rows.
  const core = ctx.CORE, cos = Math.cos, sin = Math.sin, D = Math.PI / 180;
  const gap = 8.327 / 12;   // the north row's gap, in feet (as the page reads the box)
  const north = (k, tilt) => {
    const rows = {};
    ['OL', 'IL', 'IR', 'OR', 'N', 'NI', 'SI', 'S', 'X1', 'X2', 'X3', 'X4'].forEach(g => {
      rows[g] = { on: false, n: 5, base: 3, tilt: 45, dz: 0, gap: gap, dx: 0, dy: 0, rows: 1 };
    });
    rows.N = { on: true, n: 5, base: 3, tilt: tilt, dz: 0, gap: gap, dx: 0, dy: 0, rows: k };
    return core.buildScene({ siteRise: 5, wallH: 3, wallDx: 1.3 }, rows).mods.filter(m => m.group === 'N');
  };
  expectEq('one row of five: five modules', north(1, 45).length, 5);
  expectEq('eight rows of five: forty modules', north(8, 45).length, 40);
  // Each further row is one module's long side and the gap up the tilt, in the same plane and at the same tilt.
  const stackOk = (k, tilt) => {
    const ms = north(k, tilt), step = core.MOD_L + gap;
    const up = [0, step * cos(tilt * D), step * sin(tilt * D)];
    for (let i = 0; i < 5; i++) for (let j = 0; j < k; j++) {
      const a = ms[i * k], b = ms[i * k + j];
      const d = [0, 1, 2].map(c => b.P00[c] - a.P00[c]);
      const same = [0, 1, 2].every(c => Math.abs(b.U[c] - a.U[c]) < 1e-9 && Math.abs(b.n[c] - a.n[c]) < 1e-9);
      if (!same || ![0, 1, 2].every(c => Math.abs(d[c] - j * up[c]) < 1e-9)) return false;
    }
    return true;
  };
  expectEq('four rows: each further row is one module length and the gap up the tilt, at 45 degrees', stackOk(4, 45), true);
  expectEq('eight rows: the same, at 30 degrees', stackOk(8, 30), true);

  // The Rows control on the north row: three rows is fifteen panels, and the year moves with them.
  elements.o_N_rows.value = '3'; fireEv('knobsO', 'change', { target: elements.o_N_rows }); flush();
  expectEq('three rows on the north row: fifteen panels', elements.capO.textContent, 'Plan: 54 modules');
  expectEq('the alternative is unchanged by the plan', elements.capA.textContent, 'Alternative: 44 modules');
  expectEq('the year output moves with the rows', yearText() !== LOOMIS_YEAR, true);

  // A typed count above 8 becomes 8, in the box and in the layout: 44 less the five north panels, plus forty.
  elements.o_N_rows.value = '12'; fireEv('knobsO', 'change', { target: elements.o_N_rows }); flush();
  expectEq('a typed count of 12 becomes 8 in the box', elements.o_N_rows.value, '8');
  expectEq('and the north row has eight rows: 79 modules', elements.capO.textContent, 'Plan: 79 modules');

  // The alternative's south row takes two rows too, and its own count moves.
  elements.a_S_rows.value = '2'; fireEv('knobsA', 'change', { target: elements.a_S_rows }); flush();
  expectEq('two rows on the alternative south row: five more panels', elements.capA.textContent, 'Alternative: 49 modules');

  // The scenario carries the count. A file from before the control has none: one row. A file from the checkbox version: two.
  fire('scSave', 'click'); flush();
  const saved = elements.scText.value;
  expectEq('the saved file gives the north row eight rows', /"rows": 8/.test(saved), true);
  const old = scenarioOf(saved);
  delete old.inputs.original.rows.N.rows;
  loadRaw(old);
  expectEq('a file with no row count loads the north row as one row', elements.o_N_rows.value, '1');
  expectEq('and the plan goes back to 44 modules', elements.capO.textContent, 'Plan: 44 modules');
  const checkbox = scenarioOf(saved);
  delete checkbox.inputs.original.rows.N.rows;
  checkbox.inputs.original.rows.N.two = true;
  loadRaw(checkbox);
  expectEq('a file from the checkbox version loads two rows', elements.o_N_rows.value === '2' && elements.capO.textContent === 'Plan: 49 modules', true);
  elements.scText.value = saved; fire('scLoadText', 'click'); flush();
  expectEq('loading the saved file brings the eight rows back', elements.o_N_rows.value === '8' && elements.capO.textContent === 'Plan: 79 modules', true);

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
