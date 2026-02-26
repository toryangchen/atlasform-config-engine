#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PROTO_DIR="$ROOT_DIR/packages/proto-core/proto"
SHARED_DIR="$ROOT_DIR/packages/shared-types/src/generated"

mkdir -p "$SHARED_DIR"
rm -rf "$SHARED_DIR"/*

if ! command -v protoc >/dev/null 2>&1; then
  echo "protoc not found. Install protobuf compiler first (e.g. brew install protobuf)." >&2
  exit 1
fi

PROTO_FILES="$(find "$PROTO_DIR" -type f -name '*.proto' | sort)"
if [ -z "$PROTO_FILES" ]; then
  echo "No .proto files found in $PROTO_DIR" >&2
  exit 1
fi

pnpm exec protoc \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out="$SHARED_DIR" \
  --ts_proto_opt=esModuleInterop=true,outputServices=none,useOptionals=messages \
  -I "$PROTO_DIR" \
  $PROTO_FILES

node "$ROOT_DIR/packages/proto-core/scripts/gen-manifest.mjs"

echo "proto generated to shared-types"
