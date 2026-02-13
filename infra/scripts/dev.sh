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

  local mongo_bin=""
  if command -v mongod >/dev/null 2>&1; then
    mongo_bin="$(command -v mongod)"
  elif [ -x "/opt/homebrew/opt/mongodb-community@7.0/bin/mongod" ]; then
    mongo_bin="/opt/homebrew/opt/mongodb-community@7.0/bin/mongod"
  fi

  if [ -z "$mongo_bin" ]; then
    echo "[dev] mongod not found. Install MongoDB Community 7.0 first." >&2
    exit 1
  fi

  mkdir -p "$ROOT_DIR/.mongo-data" "$ROOT_DIR/.mongo-log"
  "$mongo_bin" \
    --dbpath "$ROOT_DIR/.mongo-data" \
    --logpath "$ROOT_DIR/.mongo-log/mongod.log" \
    --fork \
    --bind_ip 127.0.0.1 \
    --port 27017

  echo "[dev] MongoDB started on 127.0.0.1:27017"
}

cd "$ROOT_DIR"
ensure_mongo
pnpm dev
