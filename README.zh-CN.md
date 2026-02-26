# AtlasForm Config Engine

Proto 驱动的配置化低代码引擎（非拖拽），面向长期产品化演进。

> ✨ 这是一个 **Vibe Coding** 项目，核心协作模型为 **GPT-5.3-Codex**。

本项目当前聚焦「多应用 + 表单驱动 + 数据管理」场景，提供：
- 基于 Proto 的应用与表单定义
- Admin 管理台（应用管理、数据列表、新增/编辑）
- NestJS + MongoDB 的后端 API
- 前后端共享类型与运行时渲染引擎

## 🎯 Web 演示（无需服务器）

- `apps/web` 运行在 **Generated TS Mode**（无需后端）。
- 数据与 schema 来自 `packages/shared-types/src/generated` 生成文件。
- 可直接部署到 GitHub Pages 做产品体验展示。

> Proto 字段解析规则、注解细则等文档将迁移到 GitHub Wiki，本 README 仅保留使用与运维信息。

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
│   ├── admin/      # 管理台（应用管理、数据管理）
│   ├── server/     # NestJS API
│   └── web/        # Runtime 示例前端
├── packages/
│   ├── component-registry/
│   ├── form-engine/
│   ├── plugin-system/
│   ├── proto-core/       # .proto 源文件 + 生成脚本
│   ├── schema-runtime/
│   ├── shared-types/     # 共享类型（含 generated）
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
- `protoc`（仅在修改 proto 并重新生成类型时需要）

安装 `protoc` 示例：
- macOS: `brew install protobuf`

## ⚡ 4. Quick Start

### 📦 4.1 Install

```bash
pnpm install
```

### 🗄️ 4.2 Start MongoDB

方式 A：你已安装并常驻 MongoDB（推荐）

方式 B：使用仓库脚本自动拉起本地 MongoDB

```bash
bash infra/scripts/dev.sh
```

说明：该脚本会尝试启动 `127.0.0.1:27017`，然后执行 `pnpm dev`。

### ▶️ 4.3 Start all services

```bash
pnpm dev
```

默认端口：
- Server: `http://localhost:3000`
- Admin: `http://localhost:5174`
- Web(Runtime): `http://localhost:5173`（Vite 默认）

## 🧰 5. Common Commands

```bash
pnpm dev                 # 启动 admin + web + server
pnpm dev:ui              # 仅启动 admin + web
pnpm dev:server          # 仅启动 server
pnpm build               # 全量构建
pnpm typecheck           # 全量类型检查
pnpm lint                # 预留
pnpm proto:gen           # proto 重新生成共享类型
```

## 🧠 6. Data & Runtime Notes

- 默认 Mongo 连接：`mongodb://127.0.0.1:27017/lowcode_platform`
- 可通过环境变量覆盖：

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/lowcode_platform"
```

- 系统默认租户请求头：`x-tenant-id: demo-tenant`
- Admin/Web 当前内置 API 地址：`http://localhost:3000`
- 图片组件上传接口默认占位为 `/api/upload`，当前仅预留

## 🏗️ 7. Build & Deployment

## 🔧 7.1 Backend (NestJS)

```bash
pnpm --filter @lowcode/server build
pnpm --filter @lowcode/server start
```

启动前请确保：
- MongoDB 可访问
- `MONGO_URI` 正确配置

## 🖥️ 7.2 Frontend (Admin / Web)

```bash
pnpm --filter @lowcode/admin build
pnpm --filter @lowcode/web build
```

产物目录：
- `apps/admin/dist`
- `apps/web/dist`

可用 Nginx/对象存储托管静态资源。

> 注意：`apps/admin/src/main.tsx` 与 `apps/web/src/main.tsx` 目前使用固定 `API_BASE`。部署到非本地地址时，请先改为你的网关地址再构建。

## 🐳 7.3 Docker (provided samples)

```bash
# Server image
Dockerfile: infra/docker/server.Dockerfile

# Web image
Dockerfile: infra/docker/web.Dockerfile
```

说明：当前仅提供基础 Dockerfile 样例，生产环境建议补充：
- 多阶段构建
- 健康检查
- 运行时环境变量注入
- 反向代理与静态资源策略

## 🔌 8. API Overview

核心路由（节选）：
- `GET /apps`
- `GET /apps/:appId/forms`
- `GET /apps/:appId/data`
- `POST /apps/:appId/data`
- `PATCH /apps/:appId/data/:dataId`
- `POST /apps/:appId/data/:dataId/publish`
- `DELETE /apps/:appId/data/:dataId`

详细接口约定统一维护在 GitHub Wiki。

## 🩺 9. Troubleshooting

### Mongo 连接失败（ECONNREFUSED 127.0.0.1:27017）

- 确认 MongoDB 已启动
- 确认 `MONGO_URI` 正确
- 检查 27017 端口占用

### `protoc not found`

- 安装 protobuf 编译器后重试
- 仅在执行 `pnpm proto:gen` 时需要

### 前端页面启动但无数据

- 确认 Server 在 `3000` 端口
- 确认 admin/web 的 `API_BASE` 指向正确地址
- 确认请求头中的租户值（默认 `demo-tenant`）

## 🗺️ 10. Roadmap (High-Level)

- Phase 1: 表单系统（当前）
- Phase 2: 页面级低代码
- Phase 3: 流程编排
- Phase 4: 可视化设计器
- Phase 5: 插件市场

## 📄 11. License

当前仓库未声明开源许可证；如需对外发布，请先补充 LICENSE。
