# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-05-15

### Added

- **Viewer**: Interactive canvas with three views (Overview / Features / Steps)
- **Layout**: ELK-based layout for features/steps, order-based layout for overview
- **Persistence**: File System Access API + localStorage for layout save/load
- **Undo/Redo**: Per-view history with Ctrl+Z / Ctrl+Shift+Z
- **Prompts**: Complete prompt system (scan-light, scan-heavy, sync) with shared schema and rules
- **Validator**: Zero-deps Node.js script for structural validation of features.json
- **Install scripts**: PowerShell + Bash scripts for injecting CodeSee into target projects
- **i18n**: Chinese/English UI toggle
- **Multi-language output**: `manifest.lang` controls semantic text language
- **Container drag**: Epic containers draggable with internal nodes following
- **Collision detection**: Containers auto-separate after offset application
- **Incremental offset model**: Overview → Features mapping preserves user adjustments
- **New node animation**: Fade-in for newly added nodes on reload
- **Error boundary**: Graceful fallback for malformed features.json
- **Auto-save**: Debounced file write (800ms) when FSA authorized

### Design Decisions

- `features.json` is the single source of truth for semantics (AI-maintained)
- `layout.json` is decoupled — user-maintained, never touched by AI
- Viewer is a pure consumer — no heuristic inference, no project-specific logic
- Prompts use progressive disclosure (entry → light/heavy) with MUST/SHOULD/MAY constraint levels
