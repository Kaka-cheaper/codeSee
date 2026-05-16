---
name: codesee
description: Maintain a semantic feature flow graph (.codesee/features.json) of this project. Activate when the user asks to scan / sync / refresh the feature map, when code changes are completed and the project has an AGENTS.md or .codesee/ directory, or when the user mentions CodeSee. Produces a JSON file describing Epics, Features, and Steps that a separate viewer renders as an interactive canvas.
---

# CodeSee Skill

Keep `.codesee/features.json` in sync with the project's actual functionality. The graph captures **what** the project does, not **how**, at three levels: Epic → Feature → Step.

## When to activate

- The user says "scan", "sync codesee", "refresh feature map", "更新功能图", or similar
- After completing a code change in a project that has `.codesee/` or `AGENTS.md` mentioning CodeSee
- When `.codesee/features.json` is missing/empty in a project that should have it

## Quick decision tree

```
1. Is .codesee/features.json missing or empty?
   YES → Run first-time scan: read .codesee/prompts/scan.md
   NO  → Continue to step 2

2. Did you just complete a code change?
   YES → Run incremental sync: read .codesee/prompts/sync.md
   NO  → Continue to step 3

3. Did the user explicitly ask to refresh?
   YES → Read .codesee/prompts/scan.md (force re-scan)
   NO  → Skip activation
```

## Project-stage awareness

`scan.md` auto-detects which sub-mode to use:

- **SDD project** (has `.specify/`, `.trellis/`, `.bmad-core/`, `.agents/skills/`) → `scan-sdd.md` (forward projection from spec/PRD)
- **Code-only light** (< 100 source files) → `scan-light.md`
- **Code-only heavy** (≥ 100 source files) → `scan-heavy.md` (4-phase)
- **Doc-only / planning** (no code yet) → `scan-planning.md`

Don't pick the sub-mode yourself. Read `scan.md` first; it routes for you.

## Hard constraints (MUST)

- Never modify files under `.codesee/prompts/` or `.codesee/scripts/`
- Never modify a feature with `locked: true`
- Never rename existing IDs (deprecate via `tags: ['deprecated']` instead)
- Always run `node .codesee/scripts/validate-features.mjs` after writing — exit code 1 must be fixed
- `flow.kind` is required on every flow edge
- `step.name` must be a verb phrase in the language specified by `manifest.lang`

See `.codesee/prompts/_rules.md` for the full constraint hierarchy (MUST / SHOULD / MAY).

## Checkpoint protocol (large tasks)

If the user's task touches 5+ files, don't wait until the end to sync. Split into logical closures (a "closure" = a user-perceivable, independently verifiable feature) and run `sync.md` after each. After all closures done, do a final integrity check (coverage / relations / epic_flow / refs / validator). See `.codesee/prompts/sync.md` § Checkpoint protocol.

## File locations in target project

| File                                         | Purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| `.codesee/features.json`                     | The data you maintain (your output)         |
| `.codesee/prompts/scan.md`                   | Entry router (read first when scanning)     |
| `.codesee/prompts/scan-sdd.md`               | SDD-mode (consume spec/PRD, no source code) |
| `.codesee/prompts/scan-light.md`             | Small project (one-shot)                    |
| `.codesee/prompts/scan-heavy.md`             | Large project (4-phase)                     |
| `.codesee/prompts/scan-planning.md`          | Doc-only project                            |
| `.codesee/prompts/sync.md`                   | Incremental update (read after code change) |
| `.codesee/prompts/_schema.md`                | features.json schema                        |
| `.codesee/prompts/_rules.md`                 | MUST / SHOULD / MAY constraints             |
| `.codesee/scripts/validate-features.mjs`     | Validator (run after every write)           |

## Before you act

Tell the user briefly:
1. Which path you'll take (sdd / light / heavy / planning / sync)
2. Why (e.g. "Detected `.specify/` directory → SDD mode")
3. What you'll write (e.g. "Will create features.json with N epics / M features")

Then proceed.

## Cross-platform compatibility

This skill follows the [agentskills.io](https://agentskills.io/) standard and works across Claude Code, Cursor, Codex, Gemini CLI, Copilot, Kiro, and 20+ other AI coding platforms. The `.codesee/` directory is platform-independent.
