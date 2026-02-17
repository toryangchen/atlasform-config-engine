# AtlasForm Config Engine (V1)

AtlasForm Config Engine 是一个 Proto 驱动的配置化低代码系统（非拖拽），面向可长期产品化演进（3-5 年）的 SaaS 基础平台。

## 1. V1 交付范围

### 已完成
- Proto -> TypeScript -> Runtime 的三层 schema 链路。
- NestJS + MongoDB 的表单版本化与数据持久化。
- Admin 多应用控制台（`一个 proto 文件 = 一个应用`）。
- Admin UI 主题化改版（品牌头部、统计卡、面包屑、响应式布局）。
- Admin 路由化页面：
  - `/apps`
  - `/apps/:appId/data`
  - `/apps/:appId/data/new`
  - `/apps/:appId/data/:dataId/edit`
- 新增/修改数据使用自动生成表单（非手写 JSON 文本）。
- Object 字段支持 Drawer 表单编辑（支持多层嵌套 object）。
- 历史脏 schema 迁移脚本（批量补齐 `schema.fields`）。

### 当前不在 V1 范围
- 可视化拖拽设计器。
- 完整 RBAC 与租户隔离策略落地。
- 插件市场与插件签名体系。

## 2. 技术栈

- Monorepo: `pnpm workspace` + `turbo`
- 语言: 全 TypeScript（strict）
- 前端:
  - `apps/web`: React + Ant Design（运行时渲染）
  - `apps/admin`: React + Ant Design + React Router（管理控制台）
- 后端:
  - `apps/server`: NestJS + Mongoose
  - 数据库: MongoDB 7.0+
- 协议与类型:
  - Proto + ts-proto
  - `packages/shared-types` 前后端共享类型

## 3. 目录说明

```txt
apps/
  web/      # 运行时低代码表单渲染
  server/   # NestJS API + Mongo 持久化
  admin/    # 多应用控制台（路由化）

packages/
  proto-core/
  shared-types/
  schema-runtime/
  form-engine/
  component-registry/
  validation-engine/
  plugin-system/
  utils/

infra/
  scripts/  # 启动、迁移等脚本
  docker/
```

## 4. 环境要求

- Node.js >= 20（建议 22）
- pnpm >= 10
- MongoDB Community >= 7.0
- `protoc`（用于 proto 生成）

## 5. 快速启动（推荐）

```bash
pnpm install
protoc --version
pnpm proto:gen
pnpm typecheck
./infra/scripts/dev.sh
```

启动后默认地址：
- Server: [http://localhost:3000](http://localhost:3000)
- Web: [http://localhost:5173](http://localhost:5173)
- Admin: [http://localhost:5174/apps](http://localhost:5174/apps)

> `./infra/scripts/dev.sh` 会自动检查并启动本地 Mongo（若 27017 未监听）。

## 6. 分应用启动（可选）

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/lowcode_platform"

pnpm --filter @lowcode/server dev
pnpm --filter @lowcode/web dev
pnpm --filter @lowcode/admin dev
```

推荐使用根脚本（避免重启 server 影响 admin/web）：

```bash
pnpm dev:ui             # 同时启动 admin + web
pnpm dev:server         # 单独启动 server
pnpm dev:server:restart # 仅重启 3000 端口 server
```

## 7. Proto 与应用关系

Proto 文件目录：
- `packages/proto-core/proto/`

规则：
- 每新增一个 `*.proto` 文件，Admin 会识别为一个新应用。
- 例如 `crm.proto` -> `appId=crm`。
- 当前已提供嵌套对象示例：`profile_app.proto`（含 `object_fields` 多层结构）。

### 7.1 字段注解（已支持）

字段注解支持放在同一行注释中，服务端会解析后写入表单 schema：

- `@label`：字段展示名称
- `@required` / `@require`：必填
- `@pattern` / `@regex`：正则校验

示例：

```proto
message ProfileAppForm {
  string username = 1; // @label: 用户名 @required: true @pattern: ^[a-zA-Z0-9_]{3,20}$
  string phone = 2;    // @label: 手机号 @required: true @regex: ^1\\d{10}$
}
```

说明：
- `@required` 也支持无值写法：`@required`（等价 true）。
- `@label: 名称*` 会自动推断为必填。

### 7.2 Enum 下拉选项注解（已支持）

`select` / `checkbox-group` 可由 enum 直接生成，且每个枚举项可定义 `label/value`：

```proto
enum Role {
  ROLE_UNSPECIFIED = 0; // @label: 请选择角色 @value: ""
  ENGINEER = 1;         // @label: 工程师 @value: engineer
  DESIGNER = 2;         // @label: 设计师 @value: designer
}
```

前端最终选项格式：
- `{ label: "工程师", value: "engineer" }`
- `{ label: "设计师", value: "designer" }`

## 8. API 概览（V1）

```txt
GET    /apps
GET    /apps/:appId/forms
GET    /apps/:appId/data
POST   /apps/:appId/data
PATCH  /apps/:appId/data/:dataId
DELETE /apps/:appId/data/:dataId

POST   /forms
GET    /forms/:formName
GET    /forms/:formName/:version
POST   /forms/:formName/publish

POST   /data/:formName/:version
GET    /data/:formName
```

## 9. 数据模型（Mongo）

### forms
- tenantId
- appId
- formName
- version
- status (`draft | published`)
- schema
- createdAt / updatedAt

### form_data
- tenantId
- appId
- formName
- version
- data
- createdAt / updatedAt

## 10. 历史脏数据迁移（重要）

用于修复历史记录 `schema.fields` 缺失问题：

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/lowcode_platform"

pnpm migrate:form-fields:dry
pnpm migrate:form-fields:apply
```

迁移策略：
- 同 `tenantId + appId + formName` 下，使用“健康版本”的 `schema.fields` 回填脏版本。
- 找不到模板时，打 `_migration` 标记并保留人工处理。

## 11. 常用命令

```bash
pnpm typecheck
pnpm build
pnpm dev
pnpm dev:ui
pnpm dev:server
pnpm dev:server:restart
pnpm proto:gen
pnpm migrate:form-fields:dry
pnpm migrate:form-fields:apply
```

## 12. V1 验收标准（建议）

- `pnpm typecheck` 全部通过。
- Server 能连接 Mongo 并启动成功。
- Admin 可完成：应用列表 -> 数据列表 -> 新增 -> 修改 -> 删除。
- 自动表单在新增/修改页可正确渲染。
- 脏 schema 迁移脚本 dry/apply 可执行。

## 13. 下一阶段建议（V1.1）

1. Admin 数据页增加筛选、分页、搜索与批量操作。  
2. 自动表单支持更丰富的嵌套字段编辑器（Object/Array<Object> 可视化）。  
3. 服务端补充审计日志、发布流约束、基础 RBAC。  
4. Proto 解析到表单 schema 的自动同步流程（减少手工创建 form）。

---

如需发布到 Git，建议在首个 Release Tag 附上：
- Mongo 初始化说明
- 迁移脚本执行记录（dry-run 与 apply 输出）
- V1 已知限制清单
