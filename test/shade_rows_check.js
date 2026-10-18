// Checks the per-row knobs (on/off, base, tilt, height difference, gap, shifts) and that the default rows reproduce the
// earlier flat-site baseline (albedo 0.40, bifaciality 0.70). Also checks the location: the sun path, the longitude and
// time zone effect on the clock, and the zone offsets from the browser's time zone data.
const fs = require('fs'), vm = require('vm');
const htmlPath = process.argv[2] || require('path').join(__dirname, '..', 'array_shading_render.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const ctx = { console: console, Math: Math };
vm.createContext(ctx);
vm.runInContext(m[1].replace('GROUPS: GROUPS, NAME: NAME, FACING: FACING, MOD_AREA_M2: MOD_AREA_M2,',
  'GROUPS: GROUPS, NAME: NAME, FACING: FACING, MOD_AREA_M2: MOD_AREA_M2, __blockedScene: blockedScene,'), ctx);
const C = ctx.CORE;
const bS = C.__blockedScene;
const D2R = Math.PI / 180;
const FT = 3.2808399, L = 2.10 * FT, W = 1.05 * FT;
const N = C.dayOfYear(12, 21), NJ = C.dayOfYear(6, 21);
let fails = 0;
function check(name, got, want, tol) {
  const pass = Math.abs(got - want) <= tol;
  if (!pass) fails++;
  console.log((pass ? 'ok    ' : 'FAIL  ') + name + ': got ' + got.toFixed(4) + ', want ' + want.toFixed(4));
}
function ok(name, cond) {
  if (!cond) fails++;
  console.log((cond ? 'ok    ' : 'FAIL  ') + name);
}
const row = (on, base, tilt, dz, gap, dx, dy) =>
  ({ on: on, base: base, tilt: tilt, dz: dz || 0, gap: gap, dx: dx || 0, dy: dy || 0 });
const flat = { siteRise: 0, wallH: 3, wallDx: 1.3 };
// Page defaults for the gap inputs (as-drawn spacing, 4 decimals).
const GAP = { OL: 0.839, IL: 1.1476, IR: 1.1476, OR: 0.839, N: 0.6939, S: 0.6939 };
const ORIG = {
  OL: row(true, 3, 45, 0, GAP.OL), IL: row(true, 3, 45, 0, GAP.IL), IR: row(true, 3, 45, 0, GAP.IR),
  OR: row(true, 3, 45, 0, GAP.OR), N: row(true, 3, 45, 0, GAP.N), S: row(true, 3, 45, 0, GAP.S)
};
const ALT = {
  OL: row(true, 3, 45, 0, GAP.OL), IL: row(true, 5, 45, 0, GAP.IL), IR: row(true, 5, 45, 0, GAP.IR),
  OR: row(true, 3, 45, 0, GAP.OR), N: row(true, 5, 45, 0, GAP.N), S: row(true, 3, 45, 0, GAP.S)
};
const clone = o => JSON.parse(JSON.stringify(o));
const xMin = sc => Math.min(...sc.mods.map(M => Math.min(...M.corners.map(q => q[0]))));

// 1. Defaults reproduce the earlier flat-site numbers.
const sO = C.buildScene(flat, ORIG), sA = C.buildScene(flat, ALT);
ok('modules: original 44, alternative 44', sO.mods.length === 44 && sA.mods.length === 44);
const eO = C.daily(sO, N), eA = C.daily(sA, N);
// Captured-energy baseline re-set when ground reflection became ray-traced (the unobstructed potential is unchanged).
check('Dec 21 original captured kWh', eO.kwh, 276.24, 0.06);
check('Dec 21 original potential kWh', eO.potKwh, 327.2, 0.06);
check('Dec 21 alternative captured kWh', eA.kwh, 286.06, 0.06);
const jO = C.daily(sO, NJ), jA = C.daily(sA, NJ);
check('Jun 21 original captured kWh', jO.kwh, 811.76, 0.06);
check('Jun 21 alternative captured kWh', jA.kwh, 823.56, 0.06);
check('albedo 0.2 original kWh', C.daily(sO, N, { albedo: 0.2, bif: 0.7 }).kwh, 258.34, 0.06);
check('albedo 0.6 original kWh', C.daily(sO, N, { albedo: 0.6, bif: 0.7 }).kwh, 294.14, 0.06);
check('original nearest edge, ft (outer west row)', xMin(sO), 0.5, 1e-9);

// 2. Rear beam: the south-most module of the east outer row (wall off, nothing south of it) takes its
// front at 9 am and its rear at 3 pm, solar time, Dec 21.
const eastRow = C.buildScene({ siteRise: 0, wallH: 0, wallDx: 1.3 }, { OR: row(true, 3, 45, 0, 0.84) });
const first = eastRow.mods[0];
const sh = h => C.frameShade(eastRow, C.sunPosition(N, h).s)[0];
check('9 am front sunlit', sh(9).frac, 1, 1e-9);
check('9 am rear sunlit', sh(9).rear, 0, 1e-9);
check('3 pm front sunlit', sh(15).frac, 0, 1e-9);
check('3 pm rear sunlit', sh(15).rear, 1, 1e-9);
ok('east row: 10 modules', eastRow.mods.length === 10 && first.group === 'OR');

// 3. Height difference: first to last module differs by exactly dz; the middle stays at the base.
const PN = clone(ALT); PN.N.dz = 2;
const nm = C.buildScene(flat, PN).mods.filter(X => X.group === 'N');
check('N row dz 2: last minus first module base, ft', nm[4].P00[2] - nm[0].P00[2], 2, 1e-9);
check('N row dz 2: middle of row stays at base 5', nm[2].P00[2], 5, 1e-9);

// 4. Base: inner rows at 7 ft put their tops at 7 + L sin 45 and over the 10 ft cap (14 modules).
const PB = clone(ALT); PB.IL.base = 7;
const sB = C.buildScene(flat, PB);
check('IL base 7: top above grade, ft', sB.mods.find(X => X.group === 'IL').topLocal, 7 + L * Math.sin(45 * D2R), 1e-6);
ok('IL base 7: 7 modules over the 10 ft cap', sB.mods.filter(X => X.topLocal > 10 + 1e-6).length === 7);

// 5. Tilt: a 30 degree inner row sits lower and its normal is steeper.
const PT = clone(ALT); PT.IL.tilt = 30;
const iT = C.buildScene(flat, PT).mods.find(X => X.group === 'IL');
check('IL tilt 30: top above grade, ft', iT.topLocal, 5 + L * Math.sin(30 * D2R), 1e-6);
check('IL tilt 30: normal, vertical part', iT.n[2], Math.cos(30 * D2R), 1e-9);

// 6. Gap: 2 ft between outer west modules; the row starts at its south end (y = 0) and steps north.
const PG = clone(ORIG); PG.OL.gap = 2;
const gOL = C.buildScene(flat, PG).mods.filter(X => X.group === 'OL');
check('OL gap 2: module pitch, ft', gOL[1].P00[1] - gOL[0].P00[1], W + 2, 1e-9);
check('OL gap 2: south end stays at y = 0 (base anchored)', gOL[0].P00[1], 0, 1e-9);
check('OL gap 2: north end at 9 pitches + one module, ft', gOL[9].P00[1] + W, 9 * (W + 2) + W, 1e-9);

// 7. Shifts: right and up move one row without changing the module count.
const PS = clone(ORIG); PS.N.dx = 3; PS.N.dy = -4; PS.OL.dx = 2; PS.OR.dy = 5;
const sS = C.buildScene(flat, PS);
const N0 = sO.mods.filter(X => X.group === 'N'), NS = sS.mods.filter(X => X.group === 'N');
ok('shifts: still 44 modules', sS.mods.length === 44);
check('N row right 3: x shift, ft', NS[0].P00[0] - N0[0].P00[0], 3, 1e-9);
check('N row up -4: y shift, ft', NS[0].P00[1] - N0[0].P00[1], -4, 1e-9);
check('OL right 2: nearest edge moves to 2.5 ft', xMin(sS), 2.5, 1e-9);

// 8. On/off: the north row off removes its five modules and the day's energy falls.
const PO = clone(ALT); PO.N.on = false;
const sNo = C.buildScene(flat, PO);
ok('N row off: 39 modules', sNo.mods.length === 39);
ok('N row off: day energy lower than with the row on', C.daily(sNo, N).kwh < eA.kwh);

// 9. Per-module incident energy (front + rear) adds up to the array total.
const sumPF = eO.perF.reduce((a, b) => a + b, 0), sumPR = eO.perR.reduce((a, b) => a + b, 0);
check('original: per-module front + rear kWh sum to the total', sumPF + sumPR, eO.kwh, 1e-9);

// 10. Ground reflection: the projected-shadow sunlit test agrees with the direct ray test (lift 1e-4 ft), and the
// reflected term never exceeds albedo x the ground's global irradiance. Sloped site, page default layout.
const sl = C.buildScene({ siteRise: 5, wallH: 3, wallDx: 1.3 }, ALT);
let disagree = 0, tested = 0, seed = 99;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (const [day, hours] of [[C.dayOfYear(12, 21), [8, 9, 15, 16]], [C.dayOfYear(6, 21), [7, 8, 9, 15, 16, 17]]]) {
  for (const h of hours) {
    const sun = C.sunPosition(day, h);
    const lit = C.litHits(sl, sl.gh, sun.s);
    for (let r = 0; r < 200; r++) {
      const k = Math.floor(rnd() * sl.gh.n);
      const g = [sl.gh.x[k], sl.gh.y[k], sl.gz(sl.gh.y[k]) + 1e-4];
      tested++;
      if ((bS(g, sun.s, sl, -1) ? 0 : 1) !== lit[k]) disagree++;
    }
  }
}
// Allows a few hits that sit within ~0.0002 ft of a shadow edge, where the direct test's 1e-4 ft lift can flip them.
ok('projected-shadow sunlit test matches the direct ray test on ' + tested + ' ground hits (disagreements: ' + disagree + ')', disagree <= tested * 0.001);
const sunJ = C.sunPosition(C.dayOfYear(6, 21), 9), TJ = C.skyTerms(sunJ);
const GJ = C.groundReflect(sl, sl.gh, sunJ, TJ, 0.4);
const bound = 0.4 * (TJ.dni * TJ.sa + TJ.dhi);
ok('ground reflection bounded by albedo x global irradiance', Math.max(...GJ.rear, ...GJ.front) <= bound + 1e-9);

// 11. Location and clock. The sun path and the energy depend on latitude; the longitude and the time zone only move the
// clock labels. Zone offsets come from the browser's time zone data for REF_YEAR (2026): daylight time starts at 2 am on
// 8 Mar 2026 (day 67) and ends at 2 am on 1 Nov 2026 (day 305), so local noon is daylight on 67 and standard on 305.
const S0 = C.DEFAULT_SITE;
check('default site passed explicitly: Dec 21 original kWh unchanged', C.daily(sO, N, { site: S0 }).kwh, eO.kwh, 1e-9);
check('the zone does not change the energy: Dec 21 original kWh in Kolkata',
  C.daily(sO, N, { site: Object.assign({}, S0, { timeZone: 'Asia/Kolkata' }) }).kwh, eO.kwh, 1e-9);
const east = Object.assign({}, S0, { lon: -118 });
check('longitude 3.2 deg further east: solar noon earlier on the clock, h',
  C.sunPosition(N, 12, east).clock - C.sunPosition(N, 12, S0).clock, -3.2 / 15, 1e-9);
check('zone Kolkata against Los Angeles on Dec 21: clock difference, h',
  C.sunPosition(N, 12, Object.assign({}, S0, { timeZone: 'Asia/Kolkata' })).clock - C.sunPosition(N, 12, S0).clock, 5.5 - (-8), 1e-9);
check('zone offset: Los Angeles, Dec 21', C.zoneOffsetOnDay('America/Los_Angeles', N), -8, 1e-9);
check('zone offset: Los Angeles, Jun 21 (daylight time)', C.zoneOffsetOnDay('America/Los_Angeles', NJ), -7, 1e-9);
check('zone offset: Los Angeles, 8 Mar 2026 (daylight from 2 am, so noon is daylight)', C.zoneOffsetOnDay('America/Los_Angeles', 67), -7, 1e-9);
check('zone offset: Los Angeles, 7 Mar 2026 (standard)', C.zoneOffsetOnDay('America/Los_Angeles', 66), -8, 1e-9);
check('zone offset: Los Angeles, 31 Oct 2026 (daylight)', C.zoneOffsetOnDay('America/Los_Angeles', 304), -7, 1e-9);
check('zone offset: Los Angeles, 1 Nov 2026 (standard again at noon)', C.zoneOffsetOnDay('America/Los_Angeles', 305), -8, 1e-9);
check('zone offset: Sydney, Jan 15 (summer, UTC+11)', C.zoneOffsetOnDay('Australia/Sydney', 15), 11, 1e-9);
check('zone offset: Sydney, Jun 21 (winter, UTC+10)', C.zoneOffsetOnDay('Australia/Sydney', NJ), 10, 1e-9);
check('zone offset: Kolkata has no daylight time', C.zoneOffsetOnDay('Asia/Kolkata', 172), 5.5, 1e-9);
ok('zone names: Los Angeles Dec 21 is PST, Jun 21 is PDT',
  C.zoneOnDay('America/Los_Angeles', N).name === 'PST' && C.zoneOnDay('America/Los_Angeles', NJ).name === 'PDT');
check('daylight time on Jun 21: clock one hour later than a fixed UTC-8 zone, h',
  C.sunPosition(NJ, 12, S0).clock - C.sunPosition(NJ, 12, Object.assign({}, S0, { timeZone: 'Etc/GMT+8' })).clock, 1, 1e-9);
ok('validZone: a known zone comes back in canonical case; unknown and empty give null',
  C.validZone('america/los_angeles') === 'America/Los_Angeles' && C.validZone('Not/AZone') === null && C.validZone('') === null);
const south = { lat: -33.9, lon: 151.2, timeZone: 'Australia/Sydney' };
const sunSouth = C.sunPosition(N, 12, south);
ok('southern site, Dec 21 noon: sun to the north', sunSouth.alt > 0 && sunSouth.s[1] > 0);
ok('northern site, Dec 21 noon: sun to the south', C.sunPosition(N, 12, S0).s[1] < 0);
ok('lat 60 N, Jun 21: sun up at 3 am solar (outside the old 4 to 20 h window)',
  C.sunPosition(NJ, 3, { lat: 60, lon: 10, timeZone: 'Europe/Oslo' }).alt > 0);
const e60 = C.daily(sO, NJ, { site: { lat: 60, lon: 10, timeZone: 'Europe/Oslo' } });
ok('lat 60 N, Jun 21: day energy finite and positive', isFinite(e60.kwh) && e60.kwh > 0);

// 12. True north offset: graph north (the sketch's up) turned clockwise by the offset gives true north, and the sun vector
// is in the sketch's frame. At 0 the noon sun in the south (Loomis, Dec 21) lies on the sketch's south side; at 90 true
// north is graph east, so the same sun lies on the sketch's west side. 360 is the same as 0.
const sK0 = C.sunPosition(N, 12, S0), sK90 = C.sunPosition(N, 12, Object.assign({}, S0, { trueNorthOffset: 90 }));
check('offset 0: noon sun on the sketch south side (y negative)', sK0.s[1], -Math.cos(sK0.alt), 1e-6);
check('offset 90: noon sun on the sketch west side (x negative)', sK90.s[0], -Math.cos(sK90.alt), 1e-6);
check('offset 90: noon sun has no graph north component', sK90.s[1], 0, 1e-6);
check('offset 90: altitude and true azimuth unchanged', sK90.alt - sK0.alt, 0, 1e-12);
check('offset 90: true azimuth unchanged', sK90.az - sK0.az, 0, 1e-12);
check('offset 360 is the same as 0', C.sunPosition(N, 12, Object.assign({}, S0, { trueNorthOffset: 360 })).s[0], sK0.s[0], 1e-12);
ok('offset 90: the day energy on the layout changes', Math.abs(C.daily(sO, N, { site: Object.assign({}, S0, { trueNorthOffset: 90 }) }).kwh - eO.kwh) > 1e-6);

// The per-step output series (kW at each quarter hour): its sum times the step is the day's output, the same as the day total
// times the output factor (rating over 1000 times module area, times the system factor).
{
  const e = C.daily(sO, N, { rating: 500, sf: 0.85 });
  ok('series: 96 quarter hours', e.series.length === 96);
  check('series: sum times the step equals the day output, kWh', e.series.reduce((a, b) => a + b, 0) * 0.25,
    e.kwh * 500 / (1000 * C.MOD_AREA_M2) * 0.85, 1e-6);
  ok('series: no output at midnight', e.series[0] === 0);
  ok('series: without a rating there is no series', C.daily(sO, N).series.every(v => v === null));
}
console.log(fails ? fails + ' check(s) failed' : 'all checks passed');
process.exitCode = fails ? 1 : 0;
