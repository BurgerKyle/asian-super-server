#!/usr/bin/env node
/** Fail CI if any JS file fails `node --check`. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const roots = [path.join(__dirname, '..', 'src'), path.join(__dirname, '..', 'test'), path.join(__dirname, '..', 'scripts')];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.isFile() && p.endsWith('.js')) files.push(p);
  }
}

for (const r of roots) walk(r);

let failed = 0;
for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    failed += 1;
    console.error(res.stderr || res.stdout || `check failed: ${file}`);
  }
}

if (failed) {
  console.error(`syntax-check: ${failed}/${files.length} files failed`);
  process.exit(1);
}
console.log(`syntax-check: ok (${files.length} files)`);
