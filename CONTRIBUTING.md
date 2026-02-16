# Contributing to Hushletter

Thank you for your interest in contributing to Hushletter! This guide will help you get started.

## Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/hushletter.git
   cd hushletter
   ```

2. **Install dependencies** (requires [Bun](https://bun.sh) 1.3+):
   ```bash
   bun install
   ```

3. **Set up environment variables**:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp packages/backend/.env.example packages/backend/.env.local
   ```
   Update the values with your [Convex](https://convex.dev) deployment details.

4. **Start development**:
   ```bash
   bun dev
   ```
   This starts the Convex backend and the TanStack Start web app at http://localhost:3000.

## Code Standards

### Linting and Formatting

This project uses **oxlint** (not ESLint) and **oxfmt** (not Prettier).

```bash
bun run lint      # Run type checking + oxlint
bun run format    # Format code with oxfmt
```

### TypeScript

- Strict mode is enabled with extra checks (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`)
- Avoid `any` types where possible

### Testing

- **Framework**: Vitest
- **Test location**: Co-located alongside source files (`*.test.ts` / `*.test.tsx`)
- **Backend tests**: Use `convex-test` for Convex function testing

```bash
bun run test      # Run all tests
```

### Forms

See [docs/FORM_HANDLING.md](docs/FORM_HANDLING.md) for form implementation patterns and conventions.

### Recommended Editor Settings

For VS Code with the [Oxc extension](https://marketplace.visualstudio.com/items?itemName=nicolo-ribaudo.oxc-vscode):

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.oxc": "always"
  },
  "oxc.typeAware": true
}
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run checks:
   ```bash
   bun run lint && bun run test && bun run build
   ```
4. Submit a PR with a clear description of what changed and why

## Commit Messages

Follow conventional commits:

- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance tasks
- `docs:` — Documentation changes
- `refactor:` — Code restructuring without behavior change
- `test:` — Adding or updating tests

## Architecture Decisions

- **UI primitives**: Base UI preferred over Radix
- **Forms**: TanStack Form (not react-hook-form)
- **Backend**: Convex real-time database (not REST APIs)
- **i18n**: Paraglide JS v2 (English + French)
- **Styling**: Tailwind CSS v4 with shadcn/ui components

## Questions?

Open an issue or start a discussion if you have questions about contributing.
