// Runs the test files at the same time, each in its own process, and then prints their output one file after another. The render
// page checks are split into parts that each start from a fresh page, so no part waits on another. The run passes when every file
// does, and it prints "done" last.
const { spawn } = require('child_process');
const path = require('path');

const files = ['shade_rows_check.js', 'shade_setup.js', 'shade_scenarios.js', 'shade_rows.js', 'shade_cap_graphs.js',
  'shade_use.js', 'shade_drag.js', 'shade_photo.js'];
const started = Date.now();

Promise.all(files.map(name => new Promise(resolve => {
  const fileStarted = Date.now();
  const child = spawn(process.execPath, [path.join(__dirname, name)], { cwd: path.join(__dirname, '..') });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('close', code => resolve({ name: name, code: code, out: out, secs: (Date.now() - fileStarted) / 1000 }));
}))).then(results => {
  let failedFiles = 0;
  results.forEach(r => {
    process.stdout.write('== ' + r.name + ' (' + r.secs.toFixed(0) + ' s)\n' + r.out);
    if (r.code !== 0) failedFiles++;
  });
  console.log(failedFiles ? failedFiles + ' file(s) failed' : 'all files passed, in ' + Math.round((Date.now() - started) / 1000) + ' s');
  console.log('done');
  process.exitCode = failedFiles ? 1 : 0;
});
