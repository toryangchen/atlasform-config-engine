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

## 🗂 Proto 组织约定

`packages/proto-core/proto/` 目录下只放两类文件夹：

- 普通应用文件夹：每个文件夹就是一个 `app`
- `_common/`：公共 proto 目录，不会被识别为应用

推荐目录结构：

```txt
packages/proto-core/proto/
  _common/
    options.proto
  user_info/
    index.proto
    user_info.proto
  profile_app/
    index.proto
    profile_app.proto
```

约定如下：

- `appId` 由应用文件夹名决定，例如 `user_info/`
- `index.proto` 只负责应用级元信息，例如 `app_name`、`app_description`
- 同一应用目录下除 `index.proto` 以外的 `.proto` 文件都视为该应用下的 proto scope
- `protoId` 由业务 proto 文件名决定，例如 `user_info.proto`
- 公共扩展和可复用定义放在 `_common/` 下，并通过 `import "_common/options.proto";` 引用

例如：

```proto
option (lowcode.meta.app_name) = "用户信息";
option (lowcode.meta.app_description) = "用户信息录入应用";
```

写在 `index.proto` 中；

```proto
option (lowcode.meta.proto_name) = "User Info";
option (lowcode.meta.proto_description) = "User Info proto";
```

写在具体业务 proto 中。

每次调整 proto 目录或内容后，执行：

```bash
pnpm proto:gen
```

以重新生成 shared types 和 runtime manifest。

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
