#!/usr/bin/env node
// CodeSee · merge Claude Code settings.json
//
// Phase 2 helper. Idempotently writes the staleness Stop hook into
// <target>/.claude/settings.json without touching unrelated entries.
//
// Why a separate script
//   - install.ps1 (Windows) and install.sh (mac/linux) both shell out here,
//     so JSON merge logic stays in one place.
//   - Node is already a hard requirement of CodeSee (validator + check-staleness).
//   - jq is not on Windows by default; python3 is uneven across users.
//
// Marker strategy
//   We tag every entry we own with `_codesee` (a string version like "1.0").
//   Claude Code ignores unknown JSON properties, but we use them to identify
//   our entries on subsequent runs (idempotent / --force / --remove).
//
// Usage
//   node merge-claude-settings.mjs --target <project>
//                                  --template <hook-template-json>
//                                  [--event Stop]
//                                  [--force]
//                                  [--remove]
//
// Exit codes
//   0  success
//   1  invalid args / IO error
//   2  user settings.json is malformed JSON (refuse to touch)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MARKER_KEY = '_codesee';
const MARKER_VERSION = '1.0';

function parseArgs(argv) {
  const args = { event: 'Stop', force: false, remove: false };
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
  process.stdout.write(`Usage: node merge-claude-settings.mjs --target <dir> --template <file> [--event Stop] [--force] [--remove]

Options:
  --target    Target project root (must exist).
  --template  Path to a JSON file shaped like { "hooks": { "Stop": [ { ... } ] } }.
  --event     Hook event name (default: Stop). Determines which array we write into.
  --force     Replace an existing CodeSee entry even if its template differs.
  --remove    Delete every entry tagged with ${MARKER_KEY}; do not write a new one.
`);
}

function die(msg, code = 1) {
  process.stderr.write(`[merge-claude-settings] ${msg}\n`);
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
  // Strip BOM if any
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
  // very small heuristic: peek at the first indented line
  const m = text.match(/\n([ \t]+)\S/);
  if (!m) return 2;
  if (m[1].includes('\t')) return '\t';
  return m[1].length || 2;
}

function main() {
  const args = parseArgs(process.argv);

  const targetDir = path.resolve(args.target);
  if (!existsSync(targetDir)) die(`--target does not exist: ${targetDir}`);

  const claudeDir = path.join(targetDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  // Read user settings (may not exist yet)
  const settings = readJsonOrEmpty(settingsPath);

  let originalText = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf-8') : '';
  if (originalText.charCodeAt(0) === 0xfeff) originalText = originalText.slice(1);
  const indent = originalText ? detectIndent(originalText) : 2;

  // Build the entry from template (only --remove skips this)
  let templateEntry = null;
  if (!args.remove) {
    const tmpl = readJson(args.template);
    const arr = tmpl?.hooks?.[args.event];
    if (!Array.isArray(arr) || arr.length === 0) {
      die(`template missing hooks.${args.event}[0]`);
    }
    // Use the first entry; tag it.
    templateEntry = { ...arr[0], [MARKER_KEY]: MARKER_VERSION };
  }

  const hooks = ensureObject(settings, 'hooks');
  const eventArr = ensureArray(hooks, args.event);

  // Find existing CodeSee entries
  const existingIdx = [];
  eventArr.forEach((entry, idx) => {
    if (entry && typeof entry === 'object' && entry[MARKER_KEY]) existingIdx.push(idx);
  });

  let action = 'noop';

  if (args.remove) {
    if (existingIdx.length === 0) {
      action = 'remove-noop';
    } else {
      // Remove from highest index downward
      for (let i = existingIdx.length - 1; i >= 0; i--) eventArr.splice(existingIdx[i], 1);
      // If hooks[event] now empty, drop it; if hooks now empty, drop it.
      if (eventArr.length === 0) delete hooks[args.event];
      if (Object.keys(hooks).length === 0) delete settings.hooks;
      action = `removed ${existingIdx.length}`;
    }
  } else {
    if (existingIdx.length === 0) {
      eventArr.push(templateEntry);
      action = 'added';
    } else {
      // Replace the first; drop any duplicates beyond the first.
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
      // De-dupe extras even when not --force (always safe)
      for (let i = existingIdx.length - 1; i >= 1; i--) eventArr.splice(existingIdx[i], 1);
    }
  }

  // Write back
  if (action !== 'noop' && action !== 'unchanged' && action !== 'remove-noop') {
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
    const out = JSON.stringify(settings, null, indent) + '\n';
    writeFileSync(settingsPath, out, { encoding: 'utf-8' });
  } else if (!existsSync(settingsPath) && !args.remove) {
    // Edge case: --noop on a fresh file means we still want to materialize
    // (but with action='added' above, we already created). This branch is unreachable.
  }

  process.stdout.write(`[merge-claude-settings] ${action} (${settingsPath})\n`);
}

main();
