# @hushletter/config

Shared TypeScript configuration for the Hushletter monorepo.

## Usage

Extend the base config in your package's `tsconfig.json`:

```json
{
  "extends": "@hushletter/config/tsconfig.base.json"
}
```

## Includes

- `tsconfig.base.json` — Strict TypeScript config with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
