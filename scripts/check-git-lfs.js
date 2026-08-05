#!/usr/bin/env node
// Warns (non-blocking) if Git LFS isn't set up, so ds/model/*.joblib files
// don't silently end up as unresolved pointer text on disk (see .gitattributes).

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function warn(lines) {
  console.warn('\n=== git-lfs setup check ===');
  lines.forEach((l) => console.warn(l));
  console.warn('===========================\n');
}

let repoRoot;
try {
  repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch {
  process.exit(0); // not a git checkout (e.g. tarball install) — nothing to check
}

try {
  execSync('git lfs version', { stdio: 'ignore' });
} catch {
  warn([
    'git-lfs does not appear to be installed.',
    'ds/model/*.joblib files are stored via Git LFS — without it, joblib.load()',
    'will fail on a small LFS pointer file instead of the real model data.',
    '',
    'Install it, then run `git lfs install && git lfs pull`:',
    '  macOS:   brew install git-lfs',
    '  Debian:  sudo apt-get install git-lfs',
    '  Windows: winget install GitHub.GitLFS  (or https://git-lfs.com)',
  ]);
  process.exit(0);
}

const modelDir = path.join(repoRoot, 'ds', 'model');
let unresolvedPointers = [];
try {
  unresolvedPointers = fs
    .readdirSync(modelDir)
    .filter((f) => f.endsWith('.joblib'))
    .filter((f) => {
      const fullPath = path.join(modelDir, f);
      const fd = fs.openSync(fullPath, 'r');
      const buf = Buffer.alloc(64);
      const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
      fs.closeSync(fd);
      return buf.slice(0, bytesRead).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1');
    });
} catch {
  process.exit(0); // ds/model missing entirely — not this check's concern
}

if (unresolvedPointers.length > 0) {
  warn([
    'The following files are still raw Git LFS pointers, not the real model data:',
    ...unresolvedPointers.map((f) => `  - ds/model/${f}`),
    '',
    'Run `git lfs pull` to fetch the actual content.',
  ]);
}

process.exit(0);
