// Two rows, tilted as a unit: the "2 rows" box on a north or south row puts a second row of the same panels up the tilt from the
// first, sharing its tilt and height difference. The scenario file carries the box; a file without it loads the row as one row.
// A part of the render page checks. test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, ctx, expectEq, fire, fireEv, flush, yearText, LOOMIS_YEAR, scenarioOf, loadRaw } = P;
(async () => {
  P.runPage(); flush();
  expectEq('the plan starts with 44 modules, one row each', elements.capO.textContent, 'Plan: 44 modules');

  // The geometry, from the core: a north row of five panels, with and without the second row.
  const core = ctx.CORE, cos = Math.cos, sin = Math.sin, D = Math.PI / 180;
  const gap = 8.327 / 12;   // the north row's gap, in feet (as the page reads the box)
  const rowsWith = two => {
    const rows = {};
    ['OL', 'IL', 'IR', 'OR', 'N', 'NI', 'SI', 'S', 'X1', 'X2', 'X3', 'X4'].forEach(g => {
      rows[g] = { on: false, n: 5, base: 3, tilt: 45, dz: 0, gap: gap, dx: 0, dy: 0, two: false };
    });
    rows.N = { on: true, n: 5, base: 3, tilt: 45, dz: 0, gap: gap, dx: 0, dy: 0, two: two };
    return rows;
  };
  const north = (two, tilt) => {
    const rows = rowsWith(two);
    rows.N.tilt = tilt;
    return core.buildScene({ siteRise: 5, wallH: 3, wallDx: 1.3 }, rows).mods.filter(m => m.group === 'N');
  };
  expectEq('one row of five: five modules', north(false, 45).length, 5);
  const pairs = north(true, 45);
  expectEq('two rows of five: ten modules', pairs.length, 10);
  // Each panel's twin is one panel's long side and the gap further up the tilt (north and up), in the same plane and tilt.
  const unitOk = (tilt) => {
    const ms = north(true, tilt), step = (core.MOD_L + gap);
    const want = [0, step * cos(tilt * D), step * sin(tilt * D)];
    return [0, 1, 2, 3, 4].every(i => {
      const a = ms[2 * i], b = ms[2 * i + 1];
      const d = [b.P00[0] - a.P00[0], b.P00[1] - a.P00[1], b.P00[2] - a.P00[2]];
      const sameTilt = [0, 1, 2].every(k => Math.abs(a.U[k] - b.U[k]) < 1e-9 && Math.abs(a.n[k] - b.n[k]) < 1e-9);
      return sameTilt && [0, 1, 2].every(k => Math.abs(d[k] - want[k]) < 1e-9);
    });
  };
  expectEq('the second row is up the tilt from the first, the panel length and the gap on, at 45 degrees', unitOk(45), true);
  expectEq('and it turns with the tilt: the same at 30 degrees', unitOk(30), true);
  // The second row sits higher than the first, by the tilt's rise.
  const rise = pairs[1].P00[2] - pairs[0].P00[2];
  expectEq('the second row rises by the step times the sine of the tilt', Math.abs(rise - (core.MOD_L + gap) * sin(45 * D)) < 1e-9, true);

  // The box on the north row: its panels again, a second row; the year moves with the new output.
  elements.o_N_two.checked = true; fireEv('knobsO', 'change', { target: elements.o_N_two }); flush();
  expectEq('two rows on the north row: five more panels', elements.capO.textContent, 'Plan: 49 modules');
  expectEq('the alternative is unchanged by the plan', elements.capA.textContent, 'Alternative: 44 modules');
  expectEq('the year output moves with the second row', yearText() !== LOOMIS_YEAR, true);

  // The alternative's south row takes the box too, and its own count moves.
  elements.a_S_two.checked = true; fireEv('knobsA', 'change', { target: elements.a_S_two }); flush();
  expectEq('two rows on the alternative south row: five more panels', elements.capA.textContent, 'Alternative: 49 modules');

  // The scenario carries the box, and a file from before two rows loads with the row as one row.
  fire('scSave', 'click'); flush();
  const saved = elements.scText.value;
  expectEq('the saved file marks the north row as two rows', /"two": true/.test(saved) && /"N": \{\s*"on": true/.test(saved), true);
  const old = scenarioOf(saved);
  delete old.inputs.original.rows.N.two;
  loadRaw(old);
  expectEq('a file with no two-row setting loads the north row as one row', elements.o_N_two.checked, false);
  expectEq('and the plan goes back to 44 modules', elements.capO.textContent, 'Plan: 44 modules');
  elements.scText.value = saved; fire('scLoadText', 'click'); flush();
  expectEq('loading the saved file brings the two rows back', elements.o_N_two.checked && elements.capO.textContent === 'Plan: 49 modules', true);

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
