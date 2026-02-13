#!/usr/bin/env bash
set -euo pipefail
pnpm install
pnpm proto:gen || true
pnpm typecheck
