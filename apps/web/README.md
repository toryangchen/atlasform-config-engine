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

## Cloudflare Pages

This app can be deployed directly to Cloudflare Pages as a static site.

Recommended Pages settings:

- Root directory: project root
- Build command:

```bash
pnpm install --frozen-lockfile && pnpm --filter @lowcode/web build:pages
```

- Build output directory:

```bash
apps/web/dist
```

Notes:

- `build:pages` forces `VITE_BASE_PATH=/`, which matches a custom domain deployment on Cloudflare Pages
- `public/_redirects` is included so SPA route refreshes fall back to `index.html`

## GitHub Pages

This app can be deployed directly to GitHub Pages as a static site.

Workflow:
- `.github/workflows/deploy-web-pages.yml`
