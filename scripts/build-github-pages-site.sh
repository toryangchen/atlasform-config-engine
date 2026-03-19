#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/site-dist"

cd "$ROOT_DIR"

CI=1 pnpm install --frozen-lockfile
pnpm --filter @lowcode/admin build:pages
pnpm --filter @lowcode/web build:pages

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/admin" "$OUT_DIR/runtime"

cp -R apps/admin/dist/. "$OUT_DIR/admin/"
cp -R apps/web/dist/. "$OUT_DIR/runtime/"

cat > "$OUT_DIR/_redirects" <<'EOF'
/admin /admin/ 301
/runtime /runtime/ 301
EOF

cat > "$OUT_DIR/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AtlasForm Config Engine</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f5f7fb;
        color: #1f2937;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(560px, calc(100vw - 32px));
        padding: 32px;
        background: #fff;
        border-radius: 20px;
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0 0 20px;
        line-height: 1.6;
      }
      .links {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      a {
        padding: 10px 16px;
        border-radius: 999px;
        text-decoration: none;
        color: white;
        background: #0a84ff;
      }
      a.secondary {
        background: #111827;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>AtlasForm Config Engine</h1>
      <p>Select a frontend entry:</p>
      <div class="links">
        <a href="/admin/">Admin</a>
        <a class="secondary" href="/runtime/">Runtime</a>
      </div>
    </main>
  </body>
</html>
EOF

echo "GitHub Pages site generated at $OUT_DIR"
