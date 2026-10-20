// The background photo: its file, width, and centre; the dimension scale; the sand ground that gives way to the photo; and the drag
// and scroll that move and scale it. A press on a module still moves that module's row. A part of the render page checks.
// test/run-parallel.js runs it in its own process, on a fresh page (see lib/shadePage.js).
const P = require('./lib/shadePage.js');
const { elements, expectEq, fire, fireEv, setVal, setChk, flush } = P;
(async () => {
  P.runPage(); flush();
  expectEq('the photo controls are off until a photo loads', [elements.bgWidth.disabled, elements.bgDrag.disabled].join(' '), 'true true');

  // A photo picked in the file box, as the browser reports it: the box keeps the name, and the picture loads on the next flush.
  const pick = (name, w, h) => {
    elements.bgFile.value = 'C:\\fakepath\\' + name;
    elements.bgFile.files = [{ name: name, width: w, height: h }];
    fireEv('bgFile', 'change', { target: elements.bgFile }); flush();
  };
  const CAP = 'scale, ft east of the origin';
  const texts = id => (elements[id]._ctx.__texts || []).map(t => t.text);
  const fillsOf = id => elements[id]._ctx.__fills || [];
  const images = id => (elements[id]._ctx.__images || []).length;
  // Forgets what the views drew, then redraws them with the photo's current width (a change to the width redraws the views).
  const redrawViews = () => {
    ['cO', 'cA'].forEach(id => { elements[id]._ctx.__texts = []; elements[id]._ctx.__fills = []; elements[id]._ctx.__images = []; });
    setVal('bgWidth', elements.bgWidth.value); fire('bgWidth', 'change'); flush();
  };
  // Is point p inside the convex quad q (4 points, in order)?
  const inside = (p, q) => {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4];
      const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (c === 0) continue;
      if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false;
    }
    return true;
  };
  const onModule = (x, y) => elements.cO._hits.some(h => inside([x, y], h.pts));
  const press = (x, y) => fireEv('cO', 'pointerdown', { clientX: x, clientY: y, pointerId: 1 });
  const move = (x, y) => fireEv('cO', 'pointermove', { clientX: x, clientY: y, pointerId: 1 });
  const release = (x, y) => { fireEv('cO', 'pointerup', { clientX: x, clientY: y, pointerId: 1 }); flush(); };
  const noPrevent = () => {};

  // The photo: 1200 by 800 pixels, starting 150 ft wide, its centre 25 ft east and 30 ft north.
  pick('aerial.jpg', 1200, 800);
  expectEq('a photo loads and reports its size', elements.bgStatus.textContent, 'aerial.jpg, 1200 × 800 px.');
  expectEq('the picker keeps the photo it loaded', elements.bgFile.value, 'C:\\fakepath\\aerial.jpg');
  expectEq('the photo starts 150 ft wide, centred 25 ft east and 30 ft north',
    [elements.bgWidth.value, elements.bgEast.value, elements.bgNorth.value].join(' '), '150 25 30');
  expectEq('the controls turn on with the photo', [elements.bgWidth.disabled, elements.bgDrag.disabled].join(' '), 'false false');

  // Drawn under the arrays: the photo fills the views where the sand ground would be, with a dimension scale on the ground.
  redrawViews();
  expectEq('the photo is drawn in both views', images('cO') > 0 && images('cA') > 0, true);
  expectEq('the sand ground is not drawn under the photo', fillsOf('cO').includes('#e9e0c9') || fillsOf('cA').includes('#e9e0c9'), false);
  expectEq('the dimension scale is labelled in feet from -10 to 60, and captioned',
    ['-10', '0', '10', '60'].every(t => texts('cO').includes(t)) && texts('cO').includes(CAP) && texts('cA').includes(CAP), true);
  // A wider photo redraws the layer.
  const key0 = elements.cO._photo.key;
  setVal('bgWidth', '160'); fire('bgWidth', 'change'); flush();
  expectEq('a new width redraws the photo layer', elements.cO._photo.key !== key0 && elements.bgWidth.value === '160', true);

  // With the drag box off, a drag orbits the view and leaves the photo where it is.
  const cam0 = JSON.stringify(elements.cO._view.Cam);
  press(300, 200); move(340, 200); release(340, 200);
  expectEq('with the box off, a drag orbits the view', JSON.stringify(elements.cO._view.Cam) !== cam0, true);
  expectEq('and the photo stays put', [elements.bgEast.value, elements.bgNorth.value].join(' '), '25 30');

  // A ground point (not on a module) for the photo drag, found in the view as it now is.
  let g = null;
  for (let y = 330; y < 440 && !g; y += 10) for (let x = 150; x < 500 && !g; x += 10) if (!onModule(x, y)) g = [x, y];
  expectEq('the view has a ground point clear of the arrays', g !== null, true);

  // With the drag box ticked, a press on the ground moves the photo with the pointer, and the view does not orbit.
  setChk('bgDrag', true);
  const cam1 = JSON.stringify(elements.cO._view.Cam);
  press(g[0], g[1]); move(g[0] + 40, g[1]);
  const moved = Math.hypot(parseFloat(elements.bgEast.value) - 25, parseFloat(elements.bgNorth.value) - 30);
  expectEq('dragging the ground with the box ticked moves the photo', moved > 1, true);
  expectEq('and the view does not orbit', JSON.stringify(elements.cO._view.Cam) === cam1, true);
  move(g[0], g[1]); release(g[0], g[1]);
  expectEq('dragging back returns the photo to its place',
    Math.abs(parseFloat(elements.bgEast.value) - 25) < 0.3 && Math.abs(parseFloat(elements.bgNorth.value) - 30) < 0.3, true);

  // Scrolling with the box ticked scales the photo, and scrolling back restores its width.
  const w0 = parseFloat(elements.bgWidth.value);
  fireEv('cO', 'wheel', { clientX: g[0], clientY: g[1], deltaY: -100, preventDefault: noPrevent }); flush();
  expectEq('scrolling up with the box ticked enlarges the photo', parseFloat(elements.bgWidth.value) > w0, true);
  fireEv('cO', 'wheel', { clientX: g[0], clientY: g[1], deltaY: 100, preventDefault: noPrevent }); flush();
  expectEq('scrolling back restores its width', Math.abs(parseFloat(elements.bgWidth.value) - w0) < 0.2, true);

  // With the box off, scrolling zooms the view and leaves the photo's width alone.
  setChk('bgDrag', false);
  const wNow = elements.bgWidth.value, view0 = JSON.stringify(elements.cO._view.P([10, 10, 0]));
  fireEv('cO', 'wheel', { clientX: 300, clientY: 200, deltaY: -100, preventDefault: noPrevent }); flush();
  expectEq('with the box off, scrolling zooms the view, not the photo',
    elements.bgWidth.value === wNow && JSON.stringify(elements.cO._view.P([10, 10, 0])) !== view0, true);

  // A press on a module still moves that module's row, with the box ticked; the photo stays where it is.
  setChk('bgDrag', true);
  const hit = elements.cO._hits.find(h => h.group === 'N');
  const mid = [0, 1].map(k => hit.pts.reduce((s, q) => s + q[k], 0) / 4);
  const r0 = elements.o_N_right.value, east1 = elements.bgEast.value;
  press(mid[0], mid[1]); move(mid[0] + 30, mid[1]); release(mid[0] + 30, mid[1]);
  expectEq('a press on a module moves its row, not the photo',
    elements.o_N_right.value !== r0 && elements.bgEast.value === east1, true);

  // Clearing the photo takes its controls away and puts the sand ground back.
  ['cO', 'cA'].forEach(id => { elements[id]._ctx.__texts = []; elements[id]._ctx.__fills = []; elements[id]._ctx.__images = []; });
  fire('bgClear', 'click'); flush();
  expectEq('clearing the photo turns its controls off and empties the picker',
    [elements.bgWidth.disabled, elements.bgFile.value, elements.bgStatus.textContent].join('|'), 'true||');
  expectEq('with no photo, the ground is sand again and there is no dimension scale',
    fillsOf('cO').includes('#e9e0c9') && !texts('cO').includes(CAP) && images('cO') === 0, true);

  // A new photo keeps the width and place of the one it replaces.
  pick('aerial.jpg', 1200, 800);
  setVal('bgWidth', '200'); fire('bgWidth', 'change'); flush();
  pick('second.png', 800, 800);
  expectEq('a new photo keeps the width and place of the one it replaces',
    [elements.bgWidth.value, elements.bgEast.value].join(' ') === '200 25' && elements.bgStatus.textContent === 'second.png, 800 × 800 px.', true);

  // The photo turns with the true north offset, as the rose does.
  const key1 = elements.cO._photo.key;
  setVal('trueNorthOffset', '30'); fire('trueNorthOffset', 'change'); flush();
  expectEq('the photo turns with the true north offset', elements.cO._photo.key !== key1, true);

  P.finish();
})().catch(e => { console.log('smoke threw:', e.stack); process.exitCode = 1; });
