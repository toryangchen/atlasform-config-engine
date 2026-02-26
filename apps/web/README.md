# @lowcode/web

Pure frontend runtime showcase for AtlasForm.

## Data source

`apps/web` only depends on generated TypeScript files in:
- `packages/shared-types/src/generated/profile_app.ts`
- `packages/shared-types/src/generated/user_info.ts`

No backend request is required.

## Run locally

```bash
pnpm --filter @lowcode/web dev
```

## Build

```bash
pnpm --filter @lowcode/web build
```

## GitHub Pages

This app can be deployed directly to GitHub Pages as a static site.

Workflow:
- `.github/workflows/deploy-web-pages.yml`
