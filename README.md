# AtlasForm Config Engine

🌐 Language

- English (default): [`README.md`](./README.md)
- 中文：[`README.zh-CN.md`](./README.zh-CN.md)

A Proto-driven, configuration-first low-code engine (non-drag-and-drop), designed for long-term product evolution.

> ✨ This is a **Vibe Coding** project powered by **GPT-5.3-Codex**.

This project currently focuses on multi-app, form-driven data management and provides:
- Proto-based app and form definitions
- Admin console (app management, data list, create/edit)
- NestJS + MongoDB backend APIs
- Shared types across frontend/backend and runtime form rendering

## 🎯 Web Demo (No Server)

- `apps/web` runs in **Generated TS Mode** (no backend required).
- Data/schema are built from generated files in `packages/shared-types/src/generated`.
- It can be deployed directly to GitHub Pages for product preview.

> Detailed Proto parsing/annotation rules are intentionally moved to GitHub Wiki. This README focuses on usage and operations.

## 🚀 1. Tech Stack

- Monorepo: `pnpm workspace` + `turborepo`
- Language: TypeScript (strict)
- Backend: NestJS + Mongoose (MongoDB)
- Frontend: React + Ant Design + Vite
- Schema pipeline: Proto -> Shared Types -> Runtime Schema -> Form Renderer

## 🧱 2. Repository Structure

```text
atlasform-config-engine/
├── apps/
│   ├── admin/      # Admin console
│   ├── server/     # NestJS API
│   └── web/        # Runtime demo frontend
├── packages/
│   ├── component-registry/
│   ├── form-engine/
│   ├── plugin-system/
│   ├── proto-core/       # .proto sources + generation scripts
│   ├── schema-runtime/
│   ├── shared-types/     # shared types (including generated files)
│   ├── utils/
│   └── validation-engine/
├── infra/
│   ├── docker/
│   └── scripts/
└── README.md
```

## ✅ 3. Prerequisites

- Node.js 22+
- pnpm 10+
- MongoDB 7.0+
- `protoc` (required only when regenerating types after proto changes)

Install `protoc` example:
- macOS: `brew install protobuf`

## ⚡ 4. Quick Start

### 📦 4.1 Install

```bash
pnpm install
```

### 🗄️ 4.2 Start MongoDB

Option A: MongoDB is already installed and running (recommended)

Option B: Use the project helper script

```bash
bash infra/scripts/dev.sh
```

This script attempts to start MongoDB at `127.0.0.1:27017`, then runs `pnpm dev`.

### ▶️ 4.3 Start all services

```bash
pnpm dev
```

Default ports:
- Server: `http://localhost:3000`
- Admin: `http://localhost:5174`
- Web (Runtime): `http://localhost:5173` (Vite default)

## 🧰 5. Common Commands

```bash
pnpm dev                 # start admin + web + server
pnpm dev:ui              # start admin + web only
pnpm dev:server          # start server only
pnpm build               # build all packages/apps
pnpm typecheck           # typecheck all packages/apps
pnpm lint                # reserved
pnpm proto:gen           # regenerate shared types from proto
```

## 🧠 6. Data & Runtime Notes

- Default Mongo URI: `mongodb://127.0.0.1:27017/lowcode_platform`
- Override with env var:

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/lowcode_platform"
```

- Default tenant header: `x-tenant-id: demo-tenant`
- Current built-in API base in Admin/Web: `http://localhost:3000`
- Image upload endpoint is currently a placeholder: `/api/upload`

## 🏗️ 7. Build & Deployment

## 🔧 7.1 Backend (NestJS)

```bash
pnpm --filter @lowcode/server build
pnpm --filter @lowcode/server start
```

Before startup, ensure:
- MongoDB is reachable
- `MONGO_URI` is set correctly

## 🖥️ 7.2 Frontend (Admin / Web)

```bash
pnpm --filter @lowcode/admin build
pnpm --filter @lowcode/web build
```

Build outputs:
- `apps/admin/dist`
- `apps/web/dist`

You can host them via Nginx or object storage/CDN.

> Note: `apps/admin/src/main.tsx` and `apps/web/src/main.tsx` currently use fixed `API_BASE`. Update them to your gateway/domain before production build.

## 🐳 7.3 Docker (provided samples)

```bash
# Server image
Dockerfile: infra/docker/server.Dockerfile

# Web image
Dockerfile: infra/docker/web.Dockerfile
```

These are baseline Docker samples. For production, you should add:
- multi-stage builds
- health checks
- runtime env injection
- reverse proxy/static asset strategy

## 🔌 8. API Overview

Core routes (subset):
- `GET /apps`
- `GET /apps/:appId/forms`
- `GET /apps/:appId/data`
- `POST /apps/:appId/data`
- `PATCH /apps/:appId/data/:dataId`
- `POST /apps/:appId/data/:dataId/publish`
- `DELETE /apps/:appId/data/:dataId`

Detailed API contracts are maintained in GitHub Wiki.

## 🩺 9. Troubleshooting

### Mongo connection error (`ECONNREFUSED 127.0.0.1:27017`)

- Ensure MongoDB is running
- Ensure `MONGO_URI` is correct
- Check whether port 27017 is occupied

### `protoc not found`

- Install protobuf compiler and retry
- Required only for `pnpm proto:gen`

### Frontend starts but no data appears

- Ensure server is running on `3000`
- Ensure `API_BASE` points to the correct backend URL
- Ensure tenant header matches expected value (default `demo-tenant`)

## 🗺️ 10. Roadmap (High-Level)

- Phase 1: Form System (current)
- Phase 2: Page-level Low-code
- Phase 3: Workflow Orchestration
- Phase 4: Visual Designer
- Phase 5: Plugin Marketplace

## 📄 11. License

No open-source license is declared yet. Add a LICENSE file before public distribution.
