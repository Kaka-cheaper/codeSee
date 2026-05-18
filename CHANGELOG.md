# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/) loosely — schema may still change between minor versions during 0.x.

> Day-to-day decision log lives in `docs/problem.md` (private). This file only lists user-facing changes.

---

## [Unreleased]

### Added

- **Hooks Phase 1 — staleness reminder**: install script now ships `.codesee/hooks/{claude-code,kiro}/` templates plus a shared zero-deps `check-staleness.mjs`. After every agent turn the hook checks `git log` against `manifest.updated_at` and prints a reminder if code changed but `features.json` did not. Always exits 0 — never blocks the agent. Manual enablement (copy template → `.claude/settings.json` or `.kiro/hooks/`); auto-detection in install is the next step.

---

## [0.5.0] — 2026-05-17

Six months of iteration on real projects (Polisim, Meituan AI Hackathon) shaped this release. Highlights: schema simplification, multi-project switcher, SDD ecosystem integration, and visual de-noising of the canvas.

### ⚠ Breaking

- **`cross_feature.kind` reduced from 4 → 3 values**: `triggers / publishes / subscribes / depends_on` → **`triggers / flow / depends_on`**. `publishes` and `subscribes` merged into a single `flow` (direction expressed by `from→to`); the loader auto-migrates old files but please update your sources to the new values.
- **`epic_flow.kind` reduced from 3 → 2 values**: `enables` removed. `A enables B` is equivalent to `B depends_on A` — loader auto-reverses direction.
- New optional field: `cross_feature.mode?: 'sync' | 'async'` for distinguishing synchronous data flow from asynchronous events.

### Added

- **Multi-project switcher** ([cac47f2](../../commit/cac47f2), [e6fd4a4](../../commit/e6fd4a4), [9134891](../../commit/9134891)): top-bar dropdown to switch between projects. Three project kinds: FSA folders (one-time auth, remembered across refresh), uploaded files (snapshot in IndexedDB), bundled examples (CodeSee itself, blog system).
- **CodeSee modeling itself** ([3fb5df2](../../commit/3fb5df2)): the default bundled example is now `features.json` of CodeSee — open the live demo and see the tool's own feature graph as proof of generality.
- **SDD framework integration** ([937a361](../../commit/937a361)): install script auto-detects `.specify/`, `.trellis/`, `.bmad-core/`, `bmad/`, `.agents/skills/`, `.agent-os/`. When detected, `scan.md` routes to a dedicated `scan-sdd.md` that consumes spec/PRD docs directly — no source reverse engineering.
- **SKILL.md cross-platform standard** ([937a361](../../commit/937a361)): install script writes `.agents/skills/codesee/SKILL.md` following [agentskills.io](https://agentskills.io/) standard. Compatible with Claude Code / Cursor / Codex / Gemini CLI / Copilot and 20+ platforms via progressive disclosure.
- **Canvas live reload** ([f4f20e0](../../commit/f4f20e0), [10f68ec](../../commit/10f68ec)): toggle the **Live** button — viewer polls `features.json` every 3 seconds, auto-applies changes, and fades in new nodes. Works for URL sources (bundled/static-host) and FSA directory handles.
- **Re-authorization banner** ([e6fd4a4](../../commit/e6fd4a4)): when an FSA project's permission lapses after browser restart, the canvas falls back to the default bundled example and shows an unobtrusive "reauthorize" banner — one click restores access.
- **Edge visual layering** ([e073449](../../commit/e073449)): cross-feature edges now use distinct colors and stroke styles per kind. `triggers` uses warm orange (user journey main line), `flow` uses blue (data/event flow), `depends_on` uses muted gray dashed.
- **Hover de-noising + focus lock** ([e073449](../../commit/e073449), [11ace7f](../../commit/11ace7f)): hover any node → unrelated nodes/edges fade to 18%, related edges thicken. Click to lock focus (survives mouse leave); Esc or click-empty clears.
- **Edge label uses `note`** ([e073449](../../commit/e073449)): cross-feature edges show the human-readable `note` (e.g. "登录后才能下单") instead of the technical kind name.
- **Drag from IDE support** ([6f82bf5](../../commit/6f82bf5), [26d8394](../../commit/26d8394), [3b69169](../../commit/3b69169), [73c6f7c](../../commit/73c6f7c), [460e8ab](../../commit/460e8ab)): when AI IDE drag-and-drop only ships `text/plain` content (not `dataTransfer.files`), parse the JSON content directly. Falls back to a clear error message when only path is shipped.
- **Sync Checkpoint protocol** ([a930de9](../../commit/a930de9), [4b3551d](../../commit/4b3551d)): for large tasks (5+ files), AI is instructed to break work into logical-closure checkpoints and sync `features.json` after each one — preventing context drift on long tasks. Multi-agent safety added: AI only upgrades `planned` features it actually edited this turn.
- **Planning mode** ([c3c20b1](../../commit/c3c20b1)): for projects that are documentation-only / pre-implementation, scan produces a "planned" features graph (`tags: ['planned']`, `confidence: 0.3`). Sync auto-promotes them to `implemented` once the corresponding code lands.
- **Bilingual UI** ([9605274](../../commit/9605274), [f81964a](../../commit/f81964a)): Chinese/English toggle in the top bar. Semantic text language is independently configurable via `manifest.lang`.
- **Bundled blog-system example** ([78257e3](../../commit/78257e3)): a second example file demonstrating cross-domain use beyond e-commerce.

### Changed

- **`features.json` is the single source of semantics** ([7de1ef0](../../commit/7de1ef0)): formalized in `docs/principles.md`. The frontend never infers semantics — when uncertain, AI must write it down.
- **Layout engine: dagre → ELK** ([3a4416a](../../commit/3a4416a), [7104449](../../commit/7104449)): better handling of compound nodes and crossings. Overview uses order-based layout for predictability ([fbdead4](../../commit/fbdead4)).
- **Default view changed to overview** ([eca6735](../../commit/eca6735)): users see the high-level Epic graph first, then drill down.
- **`localStorage` always writes** ([50e4af9](../../commit/50e4af9)): drag positions persist across refresh regardless of FSA auth state. `autoSave` now only controls FSA file write — not the localStorage draft.
- **Unified directory authorization** ([b256a4f](../../commit/b256a4f)): `features.json` and `layout.json` share a single FSA directory handle. Authorize once → all subsequent saves and loads bypass the picker.
- **Prompts restructured** ([a416f08](../../commit/a416f08)): removed progressive disclosure, switched to few-shot + tiered constraints (MUST / SHOULD / MAY).
- **`scan.md` auto-routes** ([937a361](../../commit/937a361), [c3c20b1](../../commit/c3c20b1)): entry prompt detects SDD framework, scale (light/heavy), or planning state and dispatches to the corresponding sub-prompt.

### Fixed

- **No more repeated folder pickers** ([b256a4f](../../commit/b256a4f), [7c0e56b](../../commit/7c0e56b)): once a directory is authorized, save / autosave / live reload all reuse the handle. Permission errors no longer clear the handle (was the root cause of the loop).
- **Auto-save default OFF** ([3fd3f90](../../commit/3fd3f90)): the previous default-ON was a hollow promise without FSA authorization.
- **Container drag follows internal nodes** ([85460c7](../../commit/85460c7), [40b36ff](../../commit/40b36ff), [04dece1](../../commit/04dece1)): in features view, dragging an Epic container now correctly moves all its features.
- **Layout cache regression** ([6d962e0](../../commit/6d962e0), [c55b5f0](../../commit/c55b5f0)): drag positions are saved only on user drag, not on initial layout, eliminating a (0,0) snapshot bug.
- **Refresh keeps positions** ([50e4af9](../../commit/50e4af9)): localStorage write was previously gated on `autoSave`, causing positions to vanish on refresh.
- **Whitelist for technical terms in step-name validator** ([7e9c2dc](../../commit/7e9c2dc)): JWT / DTO / API / HTTP / WS / SSE / JSON / CLI / UI no longer trigger the "ASCII-in-Chinese" warning.
- **Unknown enum tolerance** ([ab21f97](../../commit/ab21f97)): viewer no longer crashes when AI hallucinates schema-out-of-range values; falls back to default visuals and shows an `ErrorBoundary` instead of a white screen.

### Validator

- New legacy-enum migration warnings (publishes / subscribes / enables) — non-fatal, viewer auto-migrates.
- File-level smell detection ([10fcf33](../../commit/10fcf33)): error-branch coverage, async-edge ratio, cross-feature kind diversity, confidence-uniformity, and tab-cluster heuristics — all with concrete JSONPath references.

### Docs

- **Three core principles** ([7de1ef0](../../commit/7de1ef0)): see `docs/principles.md`.
- **Review checklist** ([10fcf33](../../commit/10fcf33)): seven dimensions to audit AI-generated `features.json`. See `docs/review-checklist.md`.
- **README rebuilt** ([6610dda](../../commit/6610dda), [09aaa36](../../commit/09aaa36), [288c20e](../../commit/288c20e)): rewrites for clarity, banner, badges, IDE-compatibility surface, contribution guide, social preview image.
- **Live demo on GitHub Pages** ([d7c837d](../../commit/d7c837d)).
- **Project structure regularized** ([854d652](../../commit/854d652)): added LICENSE, .editorconfig, CONTRIBUTING.md, GitHub issue/PR templates, CI for build verification.

---

## [0.1.0] — 2026-05-15

### Added

- **Viewer**: interactive canvas with three views (Overview / Features / Steps).
- **Layout**: ELK-based layout for features/steps, order-based layout for overview.
- **Persistence**: File System Access API + localStorage for layout save/load.
- **Undo/Redo**: per-view history with Ctrl+Z / Ctrl+Shift+Z.
- **Prompts**: complete prompt system (`scan-light`, `scan-heavy`, `sync`) with shared schema and rules.
- **Validator**: zero-deps Node.js script for structural validation of `features.json`.
- **Install scripts**: PowerShell + Bash for injecting CodeSee into target projects.
- **i18n**: Chinese/English UI toggle.
- **Multi-language output**: `manifest.lang` controls semantic text language.
- **Container drag**: Epic containers draggable with internal nodes following.
- **Collision detection**: containers auto-separate after offset application.
- **Incremental offset model**: overview → features mapping preserves user adjustments.
- **New node animation**: fade-in for newly added nodes on reload.
- **Error boundary**: graceful fallback for malformed `features.json`.
- **Auto-save**: debounced file write (800 ms) when FSA authorized.

### Design Decisions

- `features.json` is the single source of truth for semantics (AI-maintained).
- `layout.json` is decoupled — user-maintained, never touched by AI.
- Viewer is a pure consumer — no heuristic inference, no project-specific logic.
- Prompts use progressive disclosure (entry → light/heavy) with MUST/SHOULD/MAY constraint levels.
