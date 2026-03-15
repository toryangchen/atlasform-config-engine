#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MONGO_URI_DEFAULT="mongodb://127.0.0.1:27017/lowcode_platform"
export MONGO_URI="${MONGO_URI:-$MONGO_URI_DEFAULT}"

ensure_mongo() {
  if lsof -iTCP:27017 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    echo "[dev] MongoDB already running on 27017"
    return
  fi

  if ! command -v brew >/dev/null 2>&1; then
    echo "[dev] Homebrew not found. Please install and start mongodb-community@7.0 first." >&2
    exit 1
  fi

  echo "[dev] Starting Homebrew MongoDB service..."
  brew services start mongodb-community@7.0 >/dev/null

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if lsof -iTCP:27017 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
      echo "[dev] Homebrew MongoDB is running on 127.0.0.1:27017"
      return
    fi
    sleep 1
  done

  echo "[dev] Failed to start Homebrew MongoDB on 127.0.0.1:27017" >&2
  exit 1
}

cd "$ROOT_DIR"
ensure_mongo
pnpm dev
