#!/usr/bin/env node
/* Runtime ownership audit.
 *
 * The runtime still extends itself by assigning to global functions that an earlier script
 * declared (classic scripts + strict-mode IIFEs). That is fragile: deleting a declaration while
 * another file still assigns to the name throws `ReferenceError` at load time (this actually
 * happened while cleaning up futures.js/spot.js).
 *
 * This check fails CI when a global `name = function` assignment has no `function name(...)`
 * declaration anywhere in src/, and prints the remaining override chains so the ownership table
 * in RUNTIME_AUDIT.md can be kept honest.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
})(src);
files.sort();

/* Load order: the six classic scripts from index.html, then bootstrap.js MODULES in order. */
const BASE_ORDER = ['src/core.js', 'src/market.js', 'src/futures.js', 'src/spot.js', 'src/account.js', 'src/ui.js'];
const bootstrap = fs.readFileSync(path.join(src, 'bootstrap.js'), 'utf8');
const moduleOrder = [...bootstrap.matchAll(/'(src\/[^']+\.js)'/g)].map(m => m[1]);
const order = new Map();
BASE_ORDER.forEach((p, i) => order.set(p, i));
moduleOrder.forEach((p, i) => { if (!order.has(p)) order.set(p, BASE_ORDER.length + i); });
const rank = rel => order.has(rel) ? order.get(rel) : 9999;

const DECL = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
const ASSIGN = /(?:^|;)\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g;

const declared = new Set();
const assigns = new Map();
let scanned = 0;

for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  scanned++;
  DECL.lastIndex = 0;
  let match;
  while ((match = DECL.exec(text))) declared.add(match[1]);
  text.split(/\r?\n/).forEach((line, index) => {
    ASSIGN.lastIndex = 0;
    let hit;
    while ((hit = ASSIGN.exec(line))) {
      const name = hit[1];
      if (!assigns.has(name)) assigns.set(name, []);
      assigns.get(name).push({ file: rel, line: index + 1 });
    }
  });
}

const chains = [...assigns.entries()]
  .filter(([, sites]) => sites.length > 1)
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
for (const [, sites] of chains) sites.sort((a, b) => rank(a.file) - rank(b.file) || a.line - b.line);

console.log(`Runtime ownership: ${scanned} files scanned, ${assigns.size} overridden globals, ${chains.length} multi-site chains.\n`);
for (const [name, sites] of chains) {
  console.log(`  ${name} (${sites.length})`);
  for (const site of sites) console.log(`    - ${site.file}:${site.line}`);
}

const missing = [...assigns.entries()].filter(([name]) => !declared.has(name));
if (missing.length) {
  console.error('\nERROR: these names are assigned a function but never declared anywhere in src/:');
  for (const [name, sites] of missing) {
    console.error(`  ${name}: ${sites.map(s => `${s.file}:${s.line}`).join(', ')}`);
    console.error('  -> a strict-mode IIFE cannot assign to an undeclared global; add a declaration/stub.');
  }
  process.exit(1);
}
console.log('\nOK: every overridden global has a declaration.');
