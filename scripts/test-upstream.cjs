// Optional integration check against an existing Bend source checkout.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');
const upstream = path.resolve(process.argv[2] || '../bend2-core');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bend2-upstream-'));
const cli = process.env.TREE_SITTER || 'tree-sitter';
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.bend') ? [path.join(dir, e.name)] : []);
}
try {
  const guide = fs.readFileSync(path.join(upstream, 'guide/GUIDE.md'), 'utf8').split('## Syntax Reference')[0];
  const examples = [...guide.matchAll(/```python\n([\s\S]*?)```/g)].map((m, i) => {
    const file = path.join(temp, `guide-${i}.bend`);
    fs.writeFileSync(file, m[1]);
    return file;
  });
  const tests = files(path.join(upstream, 'tests')).filter(file => {
    const text = fs.readFileSync(file, 'utf8');
    return text.includes('#|') && !/^#\|Error:/m.test(text)
      && !text.split('\n').some(line => line.startsWith('#|exit ') && line !== '#|exit 0');
  });
  const demos = files(path.join(upstream, 'demos'));
  const paths = [...examples, path.join(upstream, 'bend2/base.bend'), ...tests, ...demos];
  const list = path.join(temp, 'paths.txt');
  fs.writeFileSync(list, paths.join('\n'));
  const got = spawnSync(cli, ['parse', '--quiet', '--paths', list], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (got.error) throw got.error;
  assert.equal(got.status, 0, got.stdout + got.stderr);
  console.log(`PASS: ${examples.length} guide examples, Base, ${tests.length} successful test programs, ${demos.length} demo files`);
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
