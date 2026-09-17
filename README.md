# tree-sitter-bend2

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for **Bend 2**,
based on its [guide](https://github.com/bendlang/bend/blob/main/guide/GUIDE.md)
and checked against the surface parser in
[`bend2/bend.ts`](https://github.com/bendlang/bend/blob/main/bend2/bend.ts).
Bend 1 uses a different language syntax.

## Use

The generated C parser is committed, so an editor can build it without Node.js:

- Language name: `bend2`
- File extension: `.bend`
- Scope: `source.bend2`
- Parser sources: `src/parser.c` and `src/scanner.c`
- Include directory: `src`
- Runtime: Tree-sitter ABI 15 (Tree-sitter 0.25 or newer)

Register this repository as a custom parser in your editor, associate `.bend`
files with `bend2`, and install its `queries/highlights.scm`. The repository also
includes `queries/tags.scm` for symbol navigation and `queries/indents.scm` for
editors supporting indentation queries. There are no Node, Rust, or Python
runtime bindings in this package; consumers compile the C parser directly.

To work on the grammar, install Node.js and a C compiler, then:

```sh
npm ci
npm run generate
npm test
npx tree-sitter parse /path/to/main.bend
npm run test:fuzz
```

## Coverage

- Imports, datatypes, constructors, laws, definitions, and `@unsafe`.
- Erased/reusable quantities, kinds, templates, dependent function/pair types,
  equality types, reflexivity, proof holes, and named/unnamed rewrites.
- Nested and multi-value matches, natural successor patterns, destructuring,
  ordinary/parallel lets, closures, and GPU calls.
- Generic types, numeric/character/string literals, escapes, operators, lists,
  tuples, array allocation, indexing, and writes.
- IO/custom-monad blocks, typed binds, discarded results, returns, and foreign
  `.c`/`.js` imports.

The external scanner handles indentation and the whitespace-sensitive distinctions
between generic brackets/comparisons, quantity markers/arithmetic, and
rewrites/modulo. Newlines inside ordinary expressions are allowed. Comments,
blank lines, CRLF, tabs, and an absent final newline are covered by tests.
The lower-level `\{...}` match-function syntax is recognized as well.

This is a syntax tree for editor tooling, not a replacement for Bend's checker.
Name resolution, pattern validity, quantity rules, literal bounds, and proof and
termination checking remain Bend's responsibility.

## Validation

`npm test` checks 28 syntax-tree fixtures, including all 16 complete guide
examples, plus incremental edits, error recovery, and editor query captures.
`npm run test:fuzz` runs 50 incremental-edit fuzz iterations per fixture.

An optional integration check uses an existing Bend checkout:

```sh
npm run test:upstream -- /path/to/bend2-core
```

The initial grammar passed the full Base library, all 856 upstream test programs
with successful expected output, all 50 demo files, and the guide examples in
Bend 2.0.4. Tests expecting errors are excluded from that integration check;
this grammar's own recovery tests cover malformed input. The exact integration
counts are printed by the command and may change as Bend evolves.

Licensed under Apache-2.0. Guide examples in the test corpus are adapted from
[Bend](https://github.com/bendlang/bend), under the same license.
