#!/usr/bin/env node
// CodeSee · merge Cursor .cursor/hooks.json
//
// Idempotently writes the staleness stop hook into
// <target>/.cursor/hooks.json without touching unrelated entries.
//
// Why a separate script
//   - install.ps1 (Windows) and install.sh (mac/linux) both shell out here,
//     so JSON merge logic stays in one place.
//   - Node is already a hard requirement of CodeSee (validator + check-staleness).
//   - Mirrors merge-claude-settings.mjs marker strategy for Cursor's schema.
//
// Marker strategy
//   We tag every entry we own with `_codesee` (a string version like "1.0").
//   Used to identify our entries on subsequent runs (idempotent / --force / --remove).
//
// Usage
//   node merge-cursor-hooks.mjs --target <project>
//                               --template <hook-template-json>
//                               [--event stop]
//                               [--force]
//                               [--remove]
//
// Exit codes
//   0  success
//   1  invalid args / IO error
//   2  user hooks.json is malformed JSON (refuse to touch)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MARKER_KEY = '_codesee';
const MARKER_VERSION = '1.0';
const HOOKS_VERSION = 1;

function parseArgs(argv) {
  const args = { event: 'stop', force: false, remove: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') args.target = argv[++i];
    else if (a === '--template') args.template = argv[++i];
    else if (a === '--event') args.event = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--remove') args.remove = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      die(`unknown argument: ${a}`);
    }
  }
  if (!args.target) die('--target is required');
  if (!args.remove && !args.template) die('--template is required (unless --remove)');
  return args;
}

function printHelp() {
  process.stdout.write(`Usage: node merge-cursor-hooks.mjs --target <dir> --template <file> [--event stop] [--force] [--remove]

Options:
  --target    Target project root (must exist).
  --template  Path to a JSON file shaped like { "version": 1, "hooks": { "stop": [ { ... } ] } }.
  --event     Hook event name (default: stop). Determines which array we write into.
  --force     Replace an existing CodeSee entry even if its template differs.
  --remove    Delete every entry tagged with ${MARKER_KEY}; do not write a new one.
`);
}

function die(msg, code = 1) {
  process.stderr.write(`[merge-cursor-hooks] ${msg}\n`);
  process.exit(code);
}

function readJsonOrEmpty(file) {
  if (!existsSync(file)) return {};
  let text;
  try {
    text = readFileSync(file, 'utf-8');
  } catch (err) {
    die(`failed to read ${file}: ${err.message}`);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.trim() === '') return {};
  try {
    const obj = JSON.parse(text);
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      die(`refusing to merge: ${file} top-level is not an object`, 2);
    }
    return obj;
  } catch (err) {
    die(`refusing to merge: ${file} is not valid JSON (${err.message})`, 2);
  }
}

function readJson(file) {
  if (!existsSync(file)) die(`template not found: ${file}`);
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    die(`template ${file} is not valid JSON: ${err.message}`);
  }
}

function ensureObject(parent, key) {
  if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) {
    parent[key] = {};
  }
  return parent[key];
}

function ensureArray(parent, key) {
  if (!Array.isArray(parent[key])) parent[key] = [];
  return parent[key];
}

function detectIndent(text) {
  const m = text.match(/\n([ \t]+)\S/);
  if (!m) return 2;
  if (m[1].includes('\t')) return '\t';
  return m[1].length || 2;
}

function main() {
  const args = parseArgs(process.argv);

  const targetDir = path.resolve(args.target);
  if (!existsSync(targetDir)) die(`--target does not exist: ${targetDir}`);

  const cursorDir = path.join(targetDir, '.cursor');
  const hooksPath = path.join(cursorDir, 'hooks.json');

  const settings = readJsonOrEmpty(hooksPath);

  let originalText = existsSync(hooksPath) ? readFileSync(hooksPath, 'utf-8') : '';
  if (originalText.charCodeAt(0) === 0xfeff) originalText = originalText.slice(1);
  const indent = originalText ? detectIndent(originalText) : 2;

  let templateEntry = null;
  if (!args.remove) {
    const tmpl = readJson(args.template);
    const arr = tmpl?.hooks?.[args.event];
    if (!Array.isArray(arr) || arr.length === 0) {
      die(`template missing hooks.${args.event}[0]`);
    }
    templateEntry = { ...arr[0], [MARKER_KEY]: MARKER_VERSION };
  }

  // Ensure Cursor schema version on write paths that keep the file.
  if (settings.version == null) settings.version = HOOKS_VERSION;

  const hooks = ensureObject(settings, 'hooks');
  const eventArr = ensureArray(hooks, args.event);

  const existingIdx = [];
  eventArr.forEach((entry, idx) => {
    if (entry && typeof entry === 'object' && entry[MARKER_KEY]) existingIdx.push(idx);
  });

  let action = 'noop';

  if (args.remove) {
    if (existingIdx.length === 0) {
      action = 'remove-noop';
    } else {
      for (let i = existingIdx.length - 1; i >= 0; i--) eventArr.splice(existingIdx[i], 1);
      if (eventArr.length === 0) delete hooks[args.event];
      if (Object.keys(hooks).length === 0) delete settings.hooks;
      action = `removed ${existingIdx.length}`;
    }
  } else {
    if (existingIdx.length === 0) {
      eventArr.push(templateEntry);
      action = 'added';
    } else {
      const first = existingIdx[0];
      const prev = JSON.stringify(eventArr[first]);
      const next = JSON.stringify(templateEntry);
      if (prev === next) {
        action = 'unchanged';
      } else if (args.force) {
        eventArr[first] = templateEntry;
        action = 'replaced';
      } else {
        action = 'kept (existing entry differs; pass --force to overwrite)';
      }
      for (let i = existingIdx.length - 1; i >= 1; i--) eventArr.splice(existingIdx[i], 1);
    }
  }

  if (action !== 'noop' && action !== 'unchanged' && action !== 'remove-noop') {
    if (!existsSync(cursorDir)) mkdirSync(cursorDir, { recursive: true });
    if (settings.version == null) settings.version = HOOKS_VERSION;
    const out = JSON.stringify(settings, null, indent) + '\n';
    writeFileSync(hooksPath, out, { encoding: 'utf-8' });
  }

  process.stdout.write(`[merge-cursor-hooks] ${action} (${hooksPath})\n`);
}

main();
