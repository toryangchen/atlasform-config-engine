import React from "react";
import ReactDOM from "react-dom/client";
import {
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import ReactDiffViewer from "react-diff-viewer";
import { componentRegistry } from "@lowcode/component-registry";
import { ArrayObjectTableField, ArrayStringTableField, FormRenderer, ObjectDrawerField } from "@lowcode/form-engine";
import { domainToRuntime } from "@lowcode/schema-runtime";
import type { DomainFieldSchema, DomainFormSchema, RuntimeFormSchema } from "@lowcode/shared-types";
import "antd/dist/reset.css";
import "./styles.css";

interface AppDefinition {
  appId: string;
  name: string;
  protoFile: string;
}

interface FormItem {
  _id: string;
  appId: string;
  formName: string;
  version: string;
  status: "draft" | "published";
  schema: Record<string, unknown>;
  updatedAt: string;
}

interface DataItem {
  _id: string;
  appId: string;
  formName: string;
  version: string;
  data: Record<string, unknown>;
  prdFormName?: string;
  prdVersion?: string;
  prdData?: Record<string, unknown>;
  prdUpdatedAt?: string;
  published?: boolean;
  deletedAt?: string;
  deleted?: boolean;
  updatedAt: string;
}

const { Header, Content } = Layout;
const { Sider } = Layout;
const API_BASE = "http://localhost:3000";
const TENANT = "demo-tenant";

componentRegistry.registerComponent("string", Input);
componentRegistry.registerComponent("textarea", Input.TextArea);
componentRegistry.registerComponent("markdown", Input.TextArea);
componentRegistry.registerComponent("json", Input.TextArea);
componentRegistry.registerComponent("number", InputNumber);
componentRegistry.registerComponent("select", Select);
componentRegistry.registerComponent("checkbox", Checkbox);
componentRegistry.registerComponent("checkbox-group", Checkbox.Group);
componentRegistry.registerComponent("switch", Switch);
componentRegistry.registerComponent("object", ObjectDrawerField);
componentRegistry.registerComponent("array", ArrayStringTableField);
componentRegistry.registerComponent("array<object>", ArrayObjectTableField);

function formatAppLabel(appId: string): string {
  return appId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function extractSchemaRoot(raw: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw.fields)) return raw;
  if (raw.schema && typeof raw.schema === "object") return raw.schema as Record<string, unknown>;
  return raw;
}

function normalizeOptions(input: unknown): Array<string | { label: string; value: string }> | null {
  if (!Array.isArray(input)) return null;
  const out: Array<string | { label: string; value: string }> = [];
  for (const item of input) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      if (typeof record.label === "string" && typeof record.value === "string") {
        out.push({ label: record.label, value: record.value });
      }
    }
  }
  return out.length > 0 ? out : null;
}

function parseDomainField(raw: Record<string, unknown>): DomainFieldSchema | null {
  const key = typeof raw.key === "string" ? raw.key : typeof raw.name === "string" ? raw.name : null;
  if (!key) return null;

  const label = typeof raw.label === "string" ? raw.label : key;
  const fieldType =
    typeof raw.fieldType === "string"
      ? raw.fieldType
      : typeof raw.field_type === "string"
        ? raw.field_type
        : typeof raw.type === "string"
          ? raw.type
          : "string";
  const options = normalizeOptions(raw.options);
  const itemType =
    raw.itemType === "string" || raw.itemType === "number" || raw.itemType === "boolean" || raw.itemType === "object"
      ? raw.itemType
      : raw.item_type === "string" ||
          raw.item_type === "number" ||
          raw.item_type === "boolean" ||
          raw.item_type === "object"
        ? raw.item_type
        : undefined;
  const objectFieldsRaw =
    raw.objectFields ??
    raw.object_fields ??
    raw.fields ??
    raw.itemObjectFields ??
    raw.item_object_fields ??
    ((raw.metadata as Record<string, unknown> | undefined)?.objectFields ?? null);
  const listInTableRaw =
    raw.listInTable ??
    raw.list_in_table ??
    raw.listVisible ??
    raw.list_visible ??
    ((raw.metadata as Record<string, unknown> | undefined)?.listInTable ?? null);
  const listInTable = typeof listInTableRaw === "boolean" ? listInTableRaw : false;
  const uniqueKeyRaw =
    raw.uniqueKey ??
    raw.unique_key ??
    ((raw.metadata as Record<string, unknown> | undefined)?.uniqueKey ?? null);
  const uniqueKey = typeof uniqueKeyRaw === "boolean" ? uniqueKeyRaw : false;

  const objectFields = Array.isArray(objectFieldsRaw)
    ? objectFieldsRaw
        .map((item) => (item && typeof item === "object" ? parseDomainField(item as Record<string, unknown>) : null))
        .filter((item): item is DomainFieldSchema => Boolean(item))
    : undefined;

  const rules = Array.isArray(raw.rules)
    ? (raw.rules as Array<Record<string, unknown>>).map((r) => ({
        type: String(r.type ?? "custom") as DomainFieldSchema["rules"][number]["type"],
        ...(typeof r.value === "string" ? { value: r.value } : {})
      }))
    : [];

  return {
    key,
    label,
    fieldType,
    required: Boolean(raw.required),
    listInTable,
    uniqueKey,
    ...(options ? { options } : {}),
    ...(itemType ? { itemType } : {}),
    ...(objectFields && objectFields.length > 0 ? { objectFields } : {}),
    rules
  };
}

function formatListCellValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined) return "-";
  if (fieldType === "array<object>") {
    if (!Array.isArray(value)) return "-";
    if (value.length === 0) return "[]";
    const first = value[0];
    const head = first && typeof first === "object" ? JSON.stringify(first) : String(first);
    return `[${value.length}] ${head}`;
  }
  if (fieldType === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "-";
    return JSON.stringify(value);
  }
  if (fieldType === "array") {
    if (!Array.isArray(value)) return String(value);
    return value.join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "{}");
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  if (!raw) return "请求失败";
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join("；");
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // fall through
  }
  return raw;
}

function toDomainSchema(form: FormItem): DomainFormSchema | null {
  const raw = form.schema as Record<string, unknown>;
  const schemaRoot = extractSchemaRoot(raw);
  const rawFields = schemaRoot.fields;
  if (!Array.isArray(rawFields)) return null;

  const fields = rawFields
    .map((item) => (item && typeof item === "object" ? parseDomainField(item as Record<string, unknown>) : null))
    .filter((item): item is DomainFieldSchema => Boolean(item));

  return {
    formName: form.formName,
    version: form.version,
    status: form.status,
    createdAt: new Date().toISOString(),
    fields
  };
}

function toRuntimeSchema(form: FormItem | undefined): RuntimeFormSchema | null {
  if (!form) return null;
  const domain = toDomainSchema(form);
  if (!domain) return null;
  const runtime = domainToRuntime(domain);

  runtime.fields = runtime.fields.map((field) => {
    if (field.componentType === "select" || field.componentType === "checkbox-group") {
      const normalizedOptions = normalizeOptions(field.props.options);
      return {
        ...field,
        props: {
          ...field.props,
          options: normalizedOptions ?? []
        }
      };
    }
    return field;
  });

  return runtime;
}

function hasRenderableSchema(form: FormItem | undefined): boolean {
  if (!form) return false;
  const raw = form.schema as Record<string, unknown>;
  return Array.isArray(extractSchemaRoot(raw).fields);
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apps, setApps] = React.useState<AppDefinition[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadApps = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/apps`);
      setApps((await res.json()) as AppDefinition[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const selectedKey = React.useMemo(() => {
    if (location.pathname === "/apps") return "apps-overview";
    const match = location.pathname.match(/^\/apps\/([^/]+)/);
    if (!match?.[1]) return "";
    return `app:${match[1]}`;
  }, [location.pathname]);

  const menuItems = React.useMemo(
    () => [
      { key: "apps-overview", label: "应用管理" },
      ...apps.map((app) => ({ key: `app:${app.appId}`, label: app.name }))
    ],
    [apps]
  );

  const onMenuClick = ({ key }: { key: string }) => {
    if (key === "apps-overview") {
      navigate("/apps");
      return;
    }
    if (key.startsWith("app:")) {
      navigate(`/apps/${key.slice(4)}/data`);
    }
  };

  return (
    <Layout className="admin-shell">
      <Header className="admin-header sticky-top">
        <div className="header-left">
          <div className="brand-dot" />
          <Typography.Text className="brand-title">AtlasForm Config Engine</Typography.Text>
          <Tag className="brand-tag">V1</Tag>
        </div>
        <Typography.Text className="header-caption">Multi-App Config Console</Typography.Text>
      </Header>
      <Layout className="admin-body">
        <Sider className="admin-sider" width={252} theme="light" breakpoint="lg" collapsedWidth={0}>
          <div className="sider-head">
            <Typography.Text className="app-switcher-title">应用导航</Typography.Text>
            <Button size="small" onClick={() => void loadApps()} loading={loading}>
              刷新
            </Button>
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={menuItems}
            onClick={onMenuClick}
            className="app-menu"
          />
        </Sider>
        <Content className="admin-content">
          <div className="content-wrap">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

function AppsPage() {
  const [apps, setApps] = React.useState<AppDefinition[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/apps`);
      setApps((await res.json()) as AppDefinition[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<AppDefinition> = [
    {
      title: "应用",
      key: "app",
      render: (_, app) => (
        <div>
          <Typography.Text strong>{app.name}</Typography.Text>
          <div>
            <Tag>{app.appId}</Tag>
          </div>
        </div>
      )
    },
    { title: "Proto 文件", dataIndex: "protoFile", key: "protoFile" },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, app) => (
        <Button type="primary" ghost onClick={() => navigate(`/apps/${app.appId}/data`)}>
          进入
        </Button>
      )
    }
  ];

  const filteredApps = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return apps;
    return apps.filter((app) => {
      const haystack = [app.name, app.appId, app.protoFile].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [apps, query]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="sticky-page-module list-breadcrumb-bar">
        <Breadcrumb
          items={[
            { title: "应用管理" }
          ]}
        />
      </div>

      <Card className="panel-card" bordered={false}>
        <div className="list-toolbar">
          <Input.Search
            allowClear
            placeholder="搜索 应用名 / appId / proto 文件"
            className="list-toolbar-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Space className="list-toolbar-actions">
            <Button onClick={() => void load()} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>
        <Table
          rowKey="appId"
          loading={loading}
          dataSource={filteredApps}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无应用，请先添加 proto 文件" /> }}
        />
      </Card>
    </Space>
  );
}

type DataScope = "active" | "deleted" | "all";

function useAppData(appId: string, scope: DataScope = "active") {
  const [forms, setForms] = React.useState<FormItem[]>([]);
  const [rows, setRows] = React.useState<DataItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const [formsRes, dataRes] = await Promise.all([
        fetch(`${API_BASE}/apps/${appId}/forms`, { headers: { "x-tenant-id": TENANT } }),
        fetch(`${API_BASE}/apps/${appId}/data?scope=${scope}`, { headers: { "x-tenant-id": TENANT } })
      ]);
      setForms((await formsRes.json()) as FormItem[]);
      setRows((await dataRes.json()) as DataItem[]);
    } finally {
      setLoading(false);
    }
  }, [appId, scope]);

  return { forms, rows, loading, load };
}

function DataListPage() {
  const { appId = "" } = useParams();
  const [api, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [showDeleted, setShowDeleted] = React.useState(false);
  const scope: DataScope = showDeleted ? "deleted" : "active";
  const { forms, rows, loading, load } = useAppData(appId, scope);
  const [query, setQuery] = React.useState("");
  const [publishTarget, setPublishTarget] = React.useState<DataItem | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishPrdChecked, setPublishPrdChecked] = React.useState(false);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPublishPrdChecked(Boolean(publishTarget?.published));
  }, [publishTarget]);

  const appLabel = React.useMemo(
    () => formatAppLabel(appId),
    [appId]
  );

  const remove = async (id: string) => {
    const res = await fetch(`${API_BASE}/apps/${appId}/data/${id}`, {
      method: "DELETE",
      headers: { "x-tenant-id": TENANT }
    });
    if (!res.ok) {
      api.error(`删除失败: ${await extractErrorMessage(res)}`);
      return;
    }
    api.success("已删除");
    await load();
  };

  const publish = async (id: string) => {
    setPublishing(true);
    const res = await fetch(`${API_BASE}/apps/${appId}/data/${id}/publish`, {
      method: "POST",
      headers: { "x-tenant-id": TENANT }
    });
    setPublishing(false);
    if (!res.ok) {
      api.error(`发布失败: ${await extractErrorMessage(res)}`);
      return;
    }
    api.success("已发布到 PRD");
    setPublishTarget(null);
    await load();
  };

  const devJson = React.useMemo(() => toPrettyJson(publishTarget?.data ?? {}), [publishTarget]);
  const prdJson = React.useMemo(() => toPrettyJson(publishTarget?.prdData ?? {}), [publishTarget]);
  const hasJsonDiff = React.useMemo(() => prdJson !== devJson, [prdJson, devJson]);

  const formDomains = React.useMemo(() => {
    const map = new Map<string, DomainFormSchema>();
    for (const form of forms) {
      const parsed = toDomainSchema(form);
      if (parsed) map.set(form.formName, parsed);
    }
    return map;
  }, [forms]);

  const listFields = React.useMemo(() => {
    const primary = rows[0]?.formName ? formDomains.get(rows[0].formName) : undefined;
    if (primary) return primary.fields.filter((f) => f.listInTable);
    const first = formDomains.values().next().value as DomainFormSchema | undefined;
    return first ? first.fields.filter((f) => f.listInTable) : [];
  }, [formDomains, rows]);

  const columns: ColumnsType<DataItem> = [
    ...listFields.map((field) => ({
      title: field.label,
      key: field.key,
      render: (_: unknown, row: DataItem) => (
        <Typography.Text ellipsis={{ tooltip: true }}>
          {formatListCellValue((row.data ?? {})[field.key], field.fieldType)}
        </Typography.Text>
      )
    })),
    {
      title: "Updated",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (v: string) => new Date(v).toLocaleString()
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      fixed: "right",
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/apps/${appId}/data/${row._id}/edit`)}>
            修改
          </Button>
          {!row.deleted && (
            <>
              <Button type="link" onClick={() => setPublishTarget(row)}>
                发布
              </Button>
              <Popconfirm title="确认删除?" onConfirm={() => void remove(row._id)}>
                <Button type="link" danger>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  const filteredRows = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const listData = listFields.map((field) => formatListCellValue((row.data ?? {})[field.key], field.fieldType));
      const haystack = [...listData, JSON.stringify(row.data ?? {})].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, query, listFields]);

  return (
    <div className="page-section">
      {contextHolder}
      <div className="sticky-page-module list-breadcrumb-bar">
        <Breadcrumb
          items={[
            { title: <Link to="/apps">应用管理</Link> },
            { title: `数据列表(${appLabel || appId})` }
          ]}
        />
      </div>

      <Card className="panel-card" bordered={false}>
        <div className="list-toolbar">
          <Input.Search
            allowClear
            placeholder="搜索表格字段 / 数据内容"
            className="list-toolbar-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Checkbox checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)}>
            已删除
          </Checkbox>
          <Space className="list-toolbar-actions">
            <Button onClick={() => void load()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={() => navigate(`/apps/${appId}/data/new`)}>
              新增数据
            </Button>
          </Space>
        </div>
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={filteredRows}
          columns={columns}
          scroll={{ x: "max-content" }}
        />
      </Card>
      <Modal
        open={Boolean(publishTarget)}
        title="发布到 PRD"
        width={1200}
        rootClassName="publish-diff-modal-root"
        centered
        onCancel={() => {
          if (!publishing) setPublishTarget(null);
        }}
        footer={
          <div className="publish-modal-footer">
            <Space className="publish-version-checks">
              <Checkbox checked disabled>
                DEV
              </Checkbox>
              <Checkbox
                checked={Boolean(publishTarget?.published) || publishPrdChecked}
                disabled={Boolean(publishTarget?.published)}
                onChange={(e) => setPublishPrdChecked(e.target.checked)}
              >
                PRD
              </Checkbox>
            </Space>
            <Space>
              <Button onClick={() => setPublishTarget(null)} disabled={publishing}>
                取消
              </Button>
              <Button
                type="primary"
                loading={publishing}
                disabled={Boolean(publishTarget?.published) || !publishPrdChecked || !hasJsonDiff}
                onClick={() => publishTarget && void publish(publishTarget._id)}
              >
                确认发布
              </Button>
            </Space>
          </div>
        }
      >
        <div className="publish-json-wrap">
          <Typography.Text type="secondary">
            左侧是 DEV，右侧是 PRD，确认后会用 DEV 覆盖 PRD。
          </Typography.Text>
          <div className="publish-json-status">
            {publishTarget?.published ? (
              <Tag color="green">该记录已发布到 PRD，不能重复发布</Tag>
            ) : hasJsonDiff ? (
              <Tag color="gold">有差异，勾选 PRD 后可发布</Tag>
            ) : (
              <Tag>无差异</Tag>
            )}
          </div>
          <div className="publish-json-diff">
            <ReactDiffViewer
              oldValue={devJson}
              newValue={prdJson}
              splitView
              hideLineNumbers={false}
              leftTitle="DEV"
              rightTitle="PRD"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DataFormPage({ mode }: { mode: "new" | "edit" }) {
  const { appId = "", dataId = "" } = useParams();
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [editorForm] = Form.useForm();
  const { forms, rows, load } = useAppData(appId, "all");
  const [loading, setLoading] = React.useState(false);
  const appLabel = React.useMemo(
    () => formatAppLabel(appId),
    [appId]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const editingRow = React.useMemo(() => rows.find((r) => r._id === dataId), [rows, dataId]);

  React.useEffect(() => {
    if (mode !== "edit") return;
    if (!editingRow) return;
    editorForm.setFieldsValue(editingRow.data);
  }, [mode, editingRow, editorForm]);

  const resolvedFormName = React.useMemo(() => {
    if (mode === "edit") return editingRow?.formName ?? "";
    return forms[0]?.formName ?? "";
  }, [mode, editingRow, forms]);

  const selectedForm = React.useMemo(() => {
    const exact = forms.find((f) => f.formName === resolvedFormName);
    if (hasRenderableSchema(exact)) return exact;
    return forms.find((f) => f.formName === resolvedFormName && hasRenderableSchema(f)) ?? exact;
  }, [forms, resolvedFormName]);

  const runtimeSchema = React.useMemo(() => {
    const schema = toRuntimeSchema(selectedForm);
    if (!schema) return null;
    if (mode !== "edit") return schema;
    return {
      ...schema,
      fields: schema.fields.map((field) => {
        const isUnique = Boolean((field.props as Record<string, unknown>).uniqueKey);
        if (!isUnique) return field;
        return {
          ...field,
          props: {
            ...field.props,
            disabled: true
          }
        };
      })
    };
  }, [selectedForm, mode]);

  const save = async () => {
    if (!resolvedFormName) {
      api.error("当前应用没有可用 form");
      return;
    }
    let values: Record<string, unknown>;
    try {
      values = (await editorForm.validateFields()) as Record<string, unknown>;
    } catch {
      api.error("请先修正表单校验错误");
      return;
    }

    setLoading(true);
    try {
      const url = mode === "new" ? `${API_BASE}/apps/${appId}/data` : `${API_BASE}/apps/${appId}/data/${dataId}`;
      const method = mode === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json", "x-tenant-id": TENANT },
        body: JSON.stringify({ formName: resolvedFormName, data: values })
      });

      if (!res.ok) {
        api.error(`保存失败: ${await extractErrorMessage(res)}`);
        return;
      }

      api.success(mode === "new" ? "新增成功" : "修改成功");
      navigate(`/apps/${appId}/data`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section">
      {contextHolder}
      <div className="sticky-page-module list-breadcrumb-bar">
        <div className="breadcrumb-row">
          <Breadcrumb
            items={[
              { title: <Link to="/apps">应用管理</Link> },
              { title: <Link to={`/apps/${appId}/data`}>{`数据列表(${appLabel || appId})`}</Link> },
              { title: mode === "new" ? "新增" : "编辑" }
            ]}
          />
        </div>
      </div>

      <Card className="panel-card" bordered={false}>
        {runtimeSchema ? (
          <>
            <FormRenderer form={editorForm} schema={runtimeSchema} />
            <div className="form-inline-actions">
              <Space>
                <Button onClick={() => navigate(`/apps/${appId}/data`)}>取消</Button>
                <Button type="primary" onClick={() => void save()} loading={loading}>
                  保存
                </Button>
              </Space>
            </div>
          </>
        ) : (
          <Empty description="当前 form schema 不可用，无法生成表单" />
        )}
      </Card>
    </div>
  );
}

function AdminApp() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0b8f76",
          borderRadius: 14,
          colorBgContainer: "#ffffff"
        }
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/apps" replace />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/:appId/data" element={<DataListPage />} />
            <Route path="/apps/:appId/data/new" element={<DataFormPage mode="new" />} />
            <Route path="/apps/:appId/data/:dataId/edit" element={<DataFormPage mode="edit" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
