#!/usr/bin/env node
// CodeSee · apply RFC 6902 JSON Patch to features.json
//
// Phase 3 helper. Implements the "patch protocol" so AI can output a small
// diff instead of the full file on every sync. AI calls this script, reads
// the JSON status line on stdout, and falls back to a full rewrite when
// patching fails.
//
// Why zero-deps and self-implemented
//   - codesee aesthetics: validator + check-staleness are also zero-deps;
//     dropping a require('fast-json-patch') breaks that.
//   - RFC 6902 is small enough to implement in ~150 lines.
//
// Usage
//   node apply-patch.mjs [--patch <path>] [--features <path>]
//                        [--no-backup] [--dry-run]
//
// Defaults
//   --patch     .codesee/cache/sync-patch.json
//   --features  .codesee/features.json
//
// Exit codes
//   0  patch applied + validator ok
//   1  patch failed / validator failed
//   2  file IO error
//
// Output
//   stdout: a single JSON line for AI to parse
//     {"ok":true,"applied":N,"backup":"<path>"}
//     {"ok":false,"stage":"apply","error":"...","failedOpIndex":N,"failedOp":{...}}
//   stderr: human-readable log

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// --- Args ---

function parseArgs(argv) {
  const args = {
    patchPath: '.codesee/cache/sync-patch.json',
    featuresPath: '.codesee/features.json',
    backup: true,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--patch') args.patchPath = argv[++i];
    else if (a === '--features') args.featuresPath = argv[++i];
    else if (a === '--no-backup') args.backup = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      die(`unknown argument: ${a}`, 2, 'args');
    }
  }
  return args;
}

function printHelp() {
  process.stderr.write(
    'Usage: node apply-patch.mjs [--patch <path>] [--features <path>] [--no-backup] [--dry-run]\n',
  );
}

// --- Output helpers ---

function emitOk(extra) {
  process.stdout.write(JSON.stringify({ ok: true, ...extra }) + '\n');
}

function die(error, code = 1, stage = 'unknown', extra = {}) {
  process.stdout.write(
    JSON.stringify({ ok: false, stage, error, ...extra }) + '\n',
  );
  process.stderr.write(`[apply-patch] ${stage}: ${error}\n`);
  process.exit(code);
}

function log(msg) {
  process.stderr.write(`[apply-patch] ${msg}\n`);
}

// --- JSON Pointer (RFC 6901) ---

/**
 * Parse a JSON Pointer string into an array of tokens.
 * Empty string => [] (root).
 * Tokens have ~1 -> '/' and ~0 -> '~' unescaping.
 */
function parsePointer(pointer) {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`pointer must start with "/" or be empty: ${JSON.stringify(pointer)}`);
  }
  return pointer
    .substring(1)
    .split('/')
    .map((tok) => tok.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * Walk the pointer down from root. Returns { parent, key, value }.
 * For the root pointer ("") returns { parent: null, key: null, value: root }.
 * Throws if a non-final segment is missing or not traversable.
 */
function resolvePointer(root, tokens) {
  if (tokens.length === 0) return { parent: null, key: null, value: root };

  let current = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const tok = tokens[i];
    if (current === null || typeof current !== 'object') {
      throw new Error(`cannot traverse non-object at "${tokens.slice(0, i).join('/')}"`);
    }
    if (Array.isArray(current)) {
      const idx = arrayIndex(tok, current.length, /*allowAppend*/ false);
      current = current[idx];
    } else {
      if (!(tok in current)) {
        throw new Error(`missing key "${tok}" at "${tokens.slice(0, i + 1).join('/')}"`);
      }
      current = current[tok];
    }
  }
  const finalKey = tokens[tokens.length - 1];
  return { parent: current, key: finalKey, value: undefined };
}

/**
 * Convert a JSON Pointer array index token to a number.
 * Supports "-" for append (only when allowAppend).
 */
function arrayIndex(tok, length, allowAppend) {
  if (tok === '-') {
    if (allowAppend) return length;
    throw new Error('"-" not allowed here (would refer to non-existent member)');
  }
  if (!/^(0|[1-9]\d*)$/.test(tok)) {
    throw new Error(`invalid array index "${tok}"`);
  }
  const idx = Number(tok);
  if (idx < 0 || idx >= length) {
    throw new Error(`array index ${idx} out of bounds (length ${length})`);
  }
  return idx;
}

// --- Operations (RFC 6902) ---

/**
 * Apply one operation to root, returning the updated root (root may be replaced
 * if the op targets the document itself).
 */
function applyOp(root, op) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) {
    throw new Error(`op must be a JSON object`);
  }
  if (typeof op.op !== 'string') throw new Error(`missing "op"`);
  if (typeof op.path !== 'string') throw new Error(`missing "path"`);

  switch (op.op) {
    case 'add':     return opAdd(root, parsePointer(op.path), op.value);
    case 'remove':  return opRemove(root, parsePointer(op.path));
    case 'replace': return opReplace(root, parsePointer(op.path), op.value);
    case 'move':    return opMove(root, parsePointer(op.from), parsePointer(op.path));
    case 'copy':    return opCopy(root, parsePointer(op.from), parsePointer(op.path));
    case 'test':    return opTest(root, parsePointer(op.path), op.value);
    default:
      throw new Error(`unknown op "${op.op}"`);
  }
}

function opAdd(root, tokens, value) {
  if (value === undefined) throw new Error('"add" requires "value"');
  if (tokens.length === 0) return value; // replace whole document

  const { parent, key } = resolvePointer(root, tokens);
  if (Array.isArray(parent)) {
    const idx = arrayIndex(key, parent.length, /*allowAppend*/ true);
    parent.splice(idx, 0, value);
  } else if (parent && typeof parent === 'object') {
    parent[key] = value;
  } else {
    throw new Error('cannot "add" into a non-container');
  }
  return root;
}

function opRemove(root, tokens) {
  if (tokens.length === 0) throw new Error('cannot "remove" the whole document');
  const { parent, key } = resolvePointer(root, tokens);
  if (Array.isArray(parent)) {
    const idx = arrayIndex(key, parent.length, /*allowAppend*/ false);
    parent.splice(idx, 1);
  } else if (parent && typeof parent === 'object') {
    if (!(key in parent)) throw new Error(`cannot "remove" missing key "${key}"`);
    delete parent[key];
  } else {
    throw new Error('cannot "remove" from a non-container');
  }
  return root;
}

function opReplace(root, tokens, value) {
  if (value === undefined) throw new Error('"replace" requires "value"');
  if (tokens.length === 0) return value; // replace whole document

  const { parent, key } = resolvePointer(root, tokens);
  if (Array.isArray(parent)) {
    const idx = arrayIndex(key, parent.length, /*allowAppend*/ false);
    parent[idx] = value;
  } else if (parent && typeof parent === 'object') {
    if (!(key in parent)) throw new Error(`cannot "replace" missing key "${key}"`);
    parent[key] = value;
  } else {
    throw new Error('cannot "replace" inside a non-container');
  }
  return root;
}

function opMove(root, fromTokens, toTokens) {
  if (fromTokens.length === 0) throw new Error('cannot "move" the whole document');
  // Forbid moving into own descendant (RFC 6902 §4.4).
  if (isPrefix(fromTokens, toTokens)) {
    throw new Error('"move" target is inside source path');
  }
  // Read value at "from", remove it, then add at "path".
  const value = readValue(root, fromTokens);
  root = opRemove(root, fromTokens);
  root = opAdd(root, toTokens, value);
  return root;
}

function opCopy(root, fromTokens, toTokens) {
  if (fromTokens.length === 0) throw new Error('cannot "copy" the whole document');
  const value = deepClone(readValue(root, fromTokens));
  return opAdd(root, toTokens, value);
}

function opTest(root, tokens, value) {
  if (value === undefined) throw new Error('"test" requires "value"');
  const actual = tokens.length === 0 ? root : readValue(root, tokens);
  if (!deepEqual(actual, value)) {
    throw new Error(`"test" failed at "/${tokens.join('/')}": values differ`);
  }
  return root;
}

// --- helpers ---

function readValue(root, tokens) {
  if (tokens.length === 0) return root;
  const { parent, key } = resolvePointer(root, tokens);
  if (Array.isArray(parent)) {
    const idx = arrayIndex(key, parent.length, /*allowAppend*/ false);
    return parent[idx];
  }
  if (parent && typeof parent === 'object') {
    if (!(key in parent)) throw new Error(`missing key "${key}"`);
    return parent[key];
  }
  throw new Error('cannot read from a non-container');
}

function isPrefix(prefix, full) {
  if (prefix.length > full.length) return false;
  for (let i = 0; i < prefix.length; i++) if (prefix[i] !== full[i]) return false;
  return true;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    if (!deepEqual(a[ak[i]], b[ak[i]])) return false;
  }
  return true;
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

// --- Backup management ---

function rotateBackups(featuresPath) {
  const dir = path.join(path.dirname(featuresPath), 'cache');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dir, `features.bak.${stamp}.json`);
  copyFileSync(featuresPath, backupPath);

  // Keep newest 3 backups
  const all = readdirSync(dir)
    .filter((f) => f.startsWith('features.bak.') && f.endsWith('.json'))
    .map((f) => path.join(dir, f))
    .sort();
  while (all.length > 3) {
    const oldest = all.shift();
    try { rmSync(oldest); } catch { /* ignore */ }
  }
  return backupPath;
}

// --- Atomic write ---

function atomicWrite(targetPath, text) {
  const tmp = targetPath + '.tmp';
  writeFileSync(tmp, text, { encoding: 'utf-8' });
  renameSync(tmp, targetPath);
}

// --- Main ---

function main() {
  const args = parseArgs(process.argv);

  // 1. Read features.json
  if (!existsSync(args.featuresPath)) {
    die(`features file not found: ${args.featuresPath}`, 2, 'read-features');
  }
  let featuresText;
  let features;
  try {
    featuresText = readFileSync(args.featuresPath, 'utf-8');
    features = JSON.parse(featuresText);
  } catch (err) {
    die(`failed to read/parse features.json: ${err.message}`, 2, 'read-features');
  }

  // 2. Read patch
  if (!existsSync(args.patchPath)) {
    die(`patch file not found: ${args.patchPath}`, 2, 'read-patch');
  }
  let patchOps;
  try {
    const patchText = readFileSync(args.patchPath, 'utf-8');
    patchOps = JSON.parse(patchText);
  } catch (err) {
    die(`failed to parse patch JSON: ${err.message}`, 1, 'read-patch');
  }
  if (!Array.isArray(patchOps)) {
    die('patch must be a JSON array of operations', 1, 'read-patch');
  }

  // 3. Detect indent of original (preserve it on write)
  const indent = detectIndent(featuresText);

  // 4. Apply each op against an in-memory clone (so failure leaves no partial state)
  let working = deepClone(features);
  for (let i = 0; i < patchOps.length; i++) {
    const op = patchOps[i];
    try {
      working = applyOp(working, op);
    } catch (err) {
      die(err.message, 1, 'apply', {
        failedOpIndex: i,
        failedOp: op,
      });
    }
  }

  // 5. Dry-run: report success without writing
  if (args.dryRun) {
    log(`dry-run: would apply ${patchOps.length} op(s); not writing.`);
    emitOk({ applied: patchOps.length, dryRun: true });
    return;
  }

  // 6. Backup
  let backupPath = null;
  if (args.backup) {
    try {
      backupPath = rotateBackups(args.featuresPath);
      log(`backup: ${backupPath}`);
    } catch (err) {
      die(`backup failed: ${err.message}`, 2, 'backup');
    }
  }

  // 7. Write atomically
  try {
    atomicWrite(args.featuresPath, JSON.stringify(working, null, indent) + '\n');
  } catch (err) {
    die(`write failed: ${err.message}`, 2, 'write');
  }

  // 8. Clean up patch file (success only). Hooks may chain another sync; we
  //    do not want stale patches to be reapplied.
  try {
    rmSync(args.patchPath);
  } catch {
    // not fatal
  }

  emitOk({
    applied: patchOps.length,
    backup: backupPath,
    features: args.featuresPath,
  });
}

function detectIndent(text) {
  const m = text.match(/\n([ \t]+)\S/);
  if (!m) return 2;
  if (m[1].includes('\t')) return '\t';
  return m[1].length || 2;
}

main();
