#!/usr/bin/env node
// CodeSee · staleness check
//
// Lightweight zero-deps script. Hooks call it after the AI agent finishes a turn
// to detect whether features.json may be stale.
//
// Behavior
//   - Read .codesee/features.json -> manifest.generated_at
//   - Run `git log --since=<generated_at> --name-only ...` for source files
//   - If 0 changed files -> exit 0, silent
//   - If N changed files -> exit 0, print a reminder to stdout
//   - If features.json missing / not in git repo -> exit 0, silent (no noise)
//
// Designed to be called from hooks, never blocks the agent. Stays informational.
//
// Exit codes
//   0  success (always; this script never fails the hook)
//   2  optional: features.json invalid (only when --strict is passed)

import { readFileSync, existsSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const STRICT = process.argv.includes('--strict');
const VERBOSE = process.argv.includes('--verbose');

// Match common code file extensions. AI sees this list as "files that may
// affect semantic flow"; non-code (md/json/css) is ignored on purpose.
const CODE_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'go', 'rs', 'java', 'kt', 'swift',
  'rb', 'php', 'cs', 'cpp', 'c', 'h', 'hpp',
  'vue', 'svelte',
];

const CWD = process.cwd();
const featuresPath = path.join(CWD, '.codesee', 'features.json');

function log(msg) {
  process.stdout.write(msg + '\n');
}

function logVerbose(msg) {
  if (VERBOSE) process.stderr.write('[staleness] ' + msg + '\n');
}

function silentExit() {
  process.exit(0);
}

// --- Step 1: read features.json ---

if (!existsSync(featuresPath)) {
  logVerbose('features.json not found at .codesee/features.json, skipping');
  silentExit();
}

let features;
try {
  const raw = readFileSync(featuresPath, 'utf-8');
  features = JSON.parse(raw);
} catch (err) {
  if (STRICT) {
    log('[CodeSee] features.json unreadable: ' + err.message);
    process.exit(2);
  }
  logVerbose('features.json unreadable: ' + err.message);
  silentExit();
}

const generatedAt = features?.manifest?.generated_at ?? features?.manifest?.updated_at;
if (!generatedAt || typeof generatedAt !== 'string') {
  logVerbose('manifest.generated_at missing or invalid, skipping');
  silentExit();
}

// --- Step 2: detect git availability ---

let gitAvailable = false;
try {
  execSync('git rev-parse --git-dir', { cwd: CWD, stdio: 'ignore' });
  gitAvailable = true;
} catch {
  logVerbose('not a git repo or git not on PATH, skipping');
  silentExit();
}

// --- Step 3: list files changed since generated_at ---

const extPathspec = CODE_EXTENSIONS.map((e) => `*.${e}`);

let raw = '';
try {
  raw = execFileSync(
    'git',
    ['log', `--since=${generatedAt}`, '--name-only', '--pretty=format:', '--', ...extPathspec],
    { cwd: CWD, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
} catch (err) {
  logVerbose('git log failed: ' + err.message);
  silentExit();
}

// Also include uncommitted working-tree changes for the same extensions.
let working = '';
try {
  working = execFileSync(
    'git',
    ['status', '--porcelain', '--', ...extPathspec],
    { cwd: CWD, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
} catch {
  // ignore
}

const changedSet = new Set();
for (const line of raw.split('\n')) {
  const f = line.trim();
  if (f) changedSet.add(f);
}
for (const line of working.split('\n')) {
  // porcelain format: "XY filename" or "XY orig -> filename"
  const m = line.match(/^.{2}\s+(?:.+\s->\s)?(.+)$/);
  if (m) changedSet.add(m[1].trim());
}

// Filter to known code extensions (porcelain may include rename arrows etc.)
const changed = [...changedSet].filter((f) => {
  const ext = f.split('.').pop()?.toLowerCase();
  return ext && CODE_EXTENSIONS.includes(ext);
});

if (changed.length === 0) {
  logVerbose('no code changes since ' + generatedAt);
  silentExit();
}

// --- Step 4: print reminder ---

const MAX_LIST = 12;
const list = changed.slice(0, MAX_LIST).map((f) => '  - ' + f).join('\n');
const moreNote = changed.length > MAX_LIST ? `\n  ... and ${changed.length - MAX_LIST} more` : '';

log('');
log('[CodeSee] features.json may be stale.');
log(`  ${changed.length} code file(s) changed since manifest.generated_at = ${generatedAt}:`);
log(list + moreNote);
log('');
log('  Recommended: read .codesee/prompts/sync.md and update features.json.');
log('  Then run: node .codesee/scripts/validate-features.mjs');
log('');

silentExit();
