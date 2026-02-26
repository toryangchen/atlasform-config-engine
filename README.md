# AtlasForm Config Engine

🌐 语言

- 中文（默认）：[`README.md`](./README.md)
- English：[`README.en.md`](./README.en.md)

一个面向长期产品化演进的 Proto 驱动、配置优先的低代码引擎（非拖拽）。

> ✨ 这是一个 **Vibe Coding** 项目，核心协作模型为 **GPT-5.3-Codex**。

AtlasForm Config Engine 是一个面向产品化的低代码平台，核心聚焦在**由 Schema 驱动的表单应用**。
它以 `.proto` 作为单一事实来源，自动生成共享类型与运行时 Schema，用于：
- 多应用表单建模
- 前后端一致的类型契约
- 表单结构演进时尽量减少 UI 手工改造

适合希望长期迭代内部系统或 SaaS 模块，并通过 Git 管控配置变更的团队。

## 🔗 链接

- 在线 Demo：[https://toryangchen.github.io/atlasform-config-engine/](https://toryangchen.github.io/atlasform-config-engine/)
- 项目 Wiki：[https://github.com/toryangchen/atlasform-config-engine/wiki](https://github.com/toryangchen/atlasform-config-engine/wiki)

## 📸 Demo 截图

**单层表单**

![Single Form](./docs/images/single_form.png)

**嵌套表单**

![Nested Form](./docs/images/nested_form.png)

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 MongoDB（如需）

```bash
bash infra/scripts/dev.sh
```

### 3. 启动全部服务

```bash
pnpm dev
```

默认端口：
- Server：`http://localhost:3000`
- Admin：`http://localhost:5174`
- Web Runtime Demo：`http://localhost:5173`

## 🧰 常用命令

```bash
pnpm dev
pnpm dev:ui
pnpm dev:server
pnpm build
pnpm typecheck
pnpm proto:gen
```

## 📝 说明

- `apps/web` 为运行时演示页面，不会持久化用户提交的表单数据。
- 详细架构、API 协议、Proto 解析规则与运维说明统一维护在 Wiki。
