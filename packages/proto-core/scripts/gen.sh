#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PROTO_DIR="$ROOT_DIR/packages/proto-core/proto"
OUT_DIR="$ROOT_DIR/packages/proto-core/generated"
SHARED_DIR="$ROOT_DIR/packages/shared-types/src/generated"

mkdir -p "$OUT_DIR" "$SHARED_DIR"
rm -f "$OUT_DIR"/*.ts "$SHARED_DIR"/*.ts

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
  --ts_proto_out="$OUT_DIR" \
  --ts_proto_opt=esModuleInterop=true,outputServices=none,useOptionals=messages \
  -I "$PROTO_DIR" \
  $PROTO_FILES

rsync -a --delete "$OUT_DIR/" "$SHARED_DIR/"
echo "proto generated and synced to shared-types"
