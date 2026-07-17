#!/usr/bin/env node
// CodeSee · Cursor stop hook wrapper
//
// Thin adapter between Cursor's stop hook protocol and the shared
// check-staleness.mjs (human-readable stdout for Claude Code / Kiro).
//
// Behavior
//   - Read stdin JSON from Cursor (status / loop_count). Fail-open on bad input.
//   - Only consider follow-up when status is missing or "completed".
//   - Run node .codesee/scripts/check-staleness.mjs; non-empty stdout = stale.
//   - Stale  -> stdout: {"followup_message":"<reminder>"}
//   - Fresh -> stdout: {}
//   - Always exit 0 (never block the agent).
//
// Working directory: project root (Cursor project hooks convention).

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const CWD = process.cwd();
const STALENESS = path.join(CWD, '.codesee', 'scripts', 'check-staleness.mjs');

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return '';
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function parseInput(raw) {
  const text = (raw || '').trim();
  if (!text) return {};
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch {
    // fail-open
  }
  return {};
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exit(0);
}

function main() {
  const input = parseInput(readStdinSync());
  const status = input.status;

  // Only auto-follow when the agent finished normally (or status omitted).
  if (status === 'aborted' || status === 'error') {
    emit({});
  }

  if (!existsSync(STALENESS)) {
    emit({});
  }

  let out = '';
  try {
    out = execFileSync(process.execPath, [STALENESS], {
      cwd: CWD,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    emit({});
  }

  const text = (out || '').trim();
  if (!text) {
    emit({});
  }

  emit({ followup_message: text });
}

main();
