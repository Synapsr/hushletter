# @hushletter/ui

Shared UI component library for Hushletter, built on shadcn/ui with Base UI primitives and Tailwind CSS v4.

## Usage

```tsx
import { Button, Input, Label } from "@hushletter/ui/components";
```

## Adding Components

Use the shadcn CLI from the web app:

```bash
cd apps/web
bunx shadcn@latest add <component-name>
```

Components are configured via `apps/web/components.json` and output to this package.

## Dependencies

- `@base-ui/react` — Unstyled accessible primitives
- `tailwind-merge` + `clsx` — Class merging utilities
- `tailwind-variants` — Variant-based styling
- `lucide-react` — Icons
