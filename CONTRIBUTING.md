# Contributing to CodeSee

Thanks for your interest in contributing! This document covers the development setup, code style, and PR process.

## 🚀 Looking for a starter task?

- **[`good first issue`](https://github.com/Kaka-cheaper/codeSee/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)** — small, well-scoped, no project-wide knowledge required. Average ~2-4 hours.
- **[`help wanted`](https://github.com/Kaka-cheaper/codeSee/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)** — bigger features, design partly settled, needs an extra pair of hands.

If something interests you, leave a comment on the issue saying "I'd like to take this" — I'll respond within 24h to confirm scope.

Don't see an issue that matches your idea? Open a [Feature Request](https://github.com/Kaka-cheaper/codeSee/issues/new?template=feature_request.md) instead — I'll either green-light it or help you reshape it.

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/user/codeSee.git
cd codeSee/viewer

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173/` to see the viewer.

## Code Style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **Functional React** — hooks only, no class components
- **Tailwind v4** — utility-first, use CSS variables from `index.css`
- **ESLint** — run `npm run lint` before committing
- **No new dependencies** without discussion — open an issue first if you need one

## Project Structure

```
viewer/src/
├── fcg/       Data types, loader, file system access
├── graph/     Canvas components, layout, node views
├── app/       TopBar, ErrorBoundary
└── lib/       Utilities (cn, i18n)
```

## Making Changes

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes
3. Ensure these pass:
   ```bash
   npm run lint
   npm run build    # includes tsc + vite build
   ```
4. Commit with a clear message: `feat(canvas): add search filter`
5. Push and open a PR

## Commit Convention

We use conventional commits:

- `feat(scope): description` — new feature
- `fix(scope): description` — bug fix
- `docs(scope): description` — documentation only
- `style(scope): description` — formatting, no logic change
- `refactor(scope): description` — code restructure, no behavior change
- `chore(scope): description` — tooling, deps, CI

Scopes: `canvas`, `layout`, `prompt`, `viewer`, `install`, `validator`, `readme`

## Pull Request Process

1. Fill out the PR template
2. Ensure CI passes (lint + build)
3. One approval required for merge
4. Squash merge preferred for clean history

## Prompts & Schema

If you're modifying prompts (`prompts/*.md`) or the schema (`_schema.md`):

- Run the validator against the example: `node scripts/validate-features.mjs viewer/public/features.json`
- Ensure `_schema.md` stays the single source of truth
- Don't add project-specific constraints — keep rules abstract

## Reporting Issues

- Use the issue templates (Bug Report / Feature Request)
- Include browser version for viewer bugs
- Include the validator output for schema-related issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
