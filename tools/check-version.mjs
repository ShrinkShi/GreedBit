#!/usr/bin/env node
/* Keep the version number in sync across the four places that users/CI can observe:
 *   VERSION            -> canonical
 *   src/core.js        -> window.GB_VERSION (single runtime source)
 *   src/bootstrap.js   -> BUILD (cache key prefix, e.g. 0026-20261103d)
 *   index.html         -> ?build=0026d
 *   README.md          -> 当前版本：**v0.0.26**
 *   CHANGELOG.md       -> ## [0.0.26]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = [];

const version = read('VERSION').trim();
const compact = version.split('.').join('');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail.push(`VERSION has an unexpected format: "${version}"`);

const core = read('src/core.js');
const coreMatch = core.match(/window\.GB_VERSION\s*=\s*'([^']+)'/);
if (!coreMatch) fail.push('src/core.js does not define window.GB_VERSION');
else if (coreMatch[1] !== version) fail.push(`src/core.js GB_VERSION is ${coreMatch[1]}, expected ${version}`);

const bootstrap = read('src/bootstrap.js');
const buildMatch = bootstrap.match(/const BUILD\s*=\s*'([^']+)'/);
if (!buildMatch) fail.push('src/bootstrap.js does not define BUILD');
else if (!buildMatch[1].startsWith(compact)) fail.push(`src/bootstrap.js BUILD is ${buildMatch[1]}, expected prefix ${compact}`);

const html = read('index.html');
const buildKey = html.match(/\?build=([A-Za-z0-9]+)/);
if (!buildKey) fail.push('index.html has no ?build= cache key');
else if (!buildKey[1].startsWith(compact)) fail.push(`index.html ?build=${buildKey[1]}, expected prefix ${compact}`);

const readme = read('README.md');
if (!readme.includes(`当前版本：**v${version}**`)) fail.push(`README.md does not say 当前版本：**v${version}**`);

const changelog = read('CHANGELOG.md');
if (!changelog.includes(`## [${version}]`)) fail.push(`CHANGELOG.md has no ## [${version}] section`);

if (fail.length) {
  console.error('Version consistency check failed:');
  for (const line of fail) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`Version consistent: ${version} (build prefix ${compact}) in VERSION / core.js / bootstrap.js / index.html / README.md / CHANGELOG.md.`);
