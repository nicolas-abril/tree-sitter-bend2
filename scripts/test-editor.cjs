const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bend2-editor-'));
const cli = process.env.TREE_SITTER || 'tree-sitter';
function run(args, allowErrors = false) {
  const got = spawnSync(cli, args, {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (got.error) throw got.error;
  if (!allowErrors) assert.equal(got.status, 0, got.stdout + got.stderr);
  return got;
}
function write(name, text) {
  const file = path.join(temp, name + '.bend');
  fs.writeFileSync(file, text);
  return file;
}
function checkEdit(source, start, removed, inserted) {
  const old = write('old', source);
  const fresh = write('fresh', source.slice(0, start) + inserted + source.slice(start + removed));
  const offset = Buffer.byteLength(source.slice(0, start));
  const length = Buffer.byteLength(source.slice(start, start + removed));
  const incremental = run(['parse', '--no-ranges', old, '--edits', `${offset} ${length} ${inserted}`]);
  const full = run(['parse', '--no-ranges', fresh]);
  assert.equal(incremental.stdout, full.stdout, 'Incremental tree differs from a fresh parse');
}
try {
  const source = 'def f(x: Nat) -> Nat:\n  match x:\n    case 0n: 0n\n    case 1n+p:\n      p\ndef after() -> Nat: 0n\n';
  checkEdit(source, 0, 0, '# a new leading comment\n\n');
  const at = source.indexOf('      p\n');
  checkEdit(source, at, '      p'.length,
    '      match p:\n        case 0n: 0n\n        case 1n+q: q');
  checkEdit(source, source.indexOf('    case 0n'), 0, '    # a case comment\n\n');
  const unicode = 'def text() -> String: "😀"\ndef after() -> Nat: 0n\n';
  checkEdit(unicode, unicode.indexOf('0n'), 2, '1n');
  // Exercise CRLF layout, tabs, trailing comments, and EOF without a newline.
  run(['parse', '--quiet', write('crlf', source.replaceAll('\n', '\r\n'))]);
  run(['parse', '--quiet', write('tabs', source.replaceAll('  ', '\t'))]);
  run(['parse', '--quiet', write('eof', source.trimEnd())]);
  for (const broken of ['def broken( -> U32:\n  0\n', 'def broken() -> U32: (1 + )\n']) {
    const file = write('broken', broken + 'def after() -> U32: 42\n');
    const parsed = run(['parse', '--no-ranges', file], true);
    assert.equal(parsed.status, 1, 'Invalid syntax should be reported');
    assert.match(parsed.stdout, /ERROR|MISSING/);
    assert.match(parsed.stdout, /\(function_definition/);
    const tags = run(['query', 'queries/tags.scm', file]);
    assert.match(tags.stdout, /text: `after`/, 'Recovery must retain the next declaration');
  }
  const file = write('highlight', 'import Base\ndef main(+x: U32) -> String: "# text"\n# comment\n');
  const highlights = run(['query', 'queries/highlights.scm', file]).stdout;
  for (const [capture, text] of [['function', 'main'], ['variable.parameter', 'x'], ['type.builtin', 'U32'], ['string', '"# text"'], ['comment', '# comment']]) {
    assert(highlights.split('\n').some(line => line.includes(`- ${capture},`) && line.includes('text: `' + text + '`')), `${capture}: ${text}`);
  }
  for (const query of ['tags', 'indents']) run(['query', '--quiet', `queries/${query}.scm`, file]);
  console.log('PASS: incremental edits, Unicode byte offsets, layout, error recovery, and editor queries');
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
