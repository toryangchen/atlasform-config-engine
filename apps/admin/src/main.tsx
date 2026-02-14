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
  Popconfirm,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
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
  updatedAt: string;
}

const { Header, Content } = Layout;
const API_BASE = "http://localhost:3000";
const TENANT = "demo-tenant";

componentRegistry.registerComponent("string", Input);
componentRegistry.registerComponent("number", InputNumber);
componentRegistry.registerComponent("select", Select);
componentRegistry.registerComponent("checkbox", Checkbox);
componentRegistry.registerComponent("checkbox-group", Checkbox.Group);
componentRegistry.registerComponent("switch", Switch);
componentRegistry.registerComponent("object", ObjectDrawerField);
componentRegistry.registerComponent("array", ArrayStringTableField);
componentRegistry.registerComponent("array<object>", ArrayObjectTableField);

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
  const options = Array.isArray(raw.options) ? (raw.options as string[]) : null;
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
    ...(options ? { options } : {}),
    ...(itemType ? { itemType } : {}),
    ...(objectFields && objectFields.length > 0 ? { objectFields } : {}),
    rules
  };
}

function toDomainSchema(form: FormItem): DomainFormSchema | null {
  const raw = form.schema as Record<string, unknown>;
  const schemaRoot =
    Array.isArray(raw.fields) ? raw : raw.schema && typeof raw.schema === "object" ? (raw.schema as Record<string, unknown>) : raw;
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
      return {
        ...field,
        props: {
          ...field.props,
          options: (Array.isArray(field.props.options) ? (field.props.options as string[]) : []).map((v) => ({ label: v, value: v }))
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
  return Boolean(Array.isArray(raw.fields) || (raw.schema && typeof raw.schema === "object" && Array.isArray((raw.schema as any).fields)));
}

const PageHero: React.FC<{ title: string; subtitle: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => {
  return (
    <Card className="hero-card" bordered={false}>
      <div className="hero-content">
        <div>
          <Typography.Title level={3} className="hero-title">
            {title}
          </Typography.Title>
          <Typography.Paragraph className="hero-subtitle">{subtitle}</Typography.Paragraph>
        </div>
        <div>{actions}</div>
      </div>
    </Card>
  );
};

function AppLayout() {
  return (
    <Layout className="admin-shell">
      <Header className="admin-header">
        <div className="header-left">
          <div className="brand-dot" />
          <Typography.Text className="brand-title">AtlasForm Config Engine</Typography.Text>
          <Tag className="brand-tag">V1</Tag>
        </div>
        <Typography.Text className="header-caption">Multi-App Config Console</Typography.Text>
      </Header>
      <Content className="admin-content">
        <div className="content-wrap">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}

function AppsPage() {
  const [apps, setApps] = React.useState<AppDefinition[]>([]);
  const [loading, setLoading] = React.useState(false);
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

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <PageHero
        title="应用管理"
        subtitle="每个 proto 文件对应一个业务应用。进入后可管理该应用的结构化数据。"
        actions={
          <Button onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        }
      />

      <div className="metrics-grid">
        <Card className="metric-card" bordered={false}>
          <Statistic title="应用总数" value={apps.length} />
        </Card>
      </div>

      <Card className="panel-card" bordered={false}>
        <Table
          rowKey="appId"
          loading={loading}
          dataSource={apps}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无应用，请先添加 proto 文件" /> }}
        />
      </Card>
    </Space>
  );
}

function useAppData(appId: string) {
  const [forms, setForms] = React.useState<FormItem[]>([]);
  const [rows, setRows] = React.useState<DataItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const [formsRes, dataRes] = await Promise.all([
        fetch(`${API_BASE}/apps/${appId}/forms`, { headers: { "x-tenant-id": TENANT } }),
        fetch(`${API_BASE}/apps/${appId}/data`, { headers: { "x-tenant-id": TENANT } })
      ]);
      setForms((await formsRes.json()) as FormItem[]);
      setRows((await dataRes.json()) as DataItem[]);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  return { forms, rows, loading, load };
}

function DataListPage() {
  const { appId = "" } = useParams();
  const [api, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const { rows, forms, loading, load } = useAppData(appId);

  React.useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    const res = await fetch(`${API_BASE}/apps/${appId}/data/${id}`, {
      method: "DELETE",
      headers: { "x-tenant-id": TENANT }
    });
    if (!res.ok) {
      api.error("删除失败");
      return;
    }
    api.success("已删除");
    await load();
  };

  const columns: ColumnsType<DataItem> = [
    { title: "ID", dataIndex: "_id", key: "_id", width: 180 },
    { title: "Form", dataIndex: "formName", key: "formName", width: 180 },
    { title: "Version", dataIndex: "version", key: "version", width: 100 },
    {
      title: "Data 预览",
      key: "data",
      render: (_, row) => <Typography.Text className="json-preview">{JSON.stringify(row.data, null, 2)}</Typography.Text>
    },
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
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/apps/${appId}/data/${row._id}/edit`)}>
            修改
          </Button>
          <Popconfirm title="确认删除?" onConfirm={() => void remove(row._id)}>
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <PageHero
        title={`数据列表 · ${appId}`}
        subtitle="查看、编辑并维护该应用下的全部业务数据。"
        actions={
          <Space>
            <Button onClick={() => void load()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={() => navigate(`/apps/${appId}/data/new`)}>
              新增数据
            </Button>
          </Space>
        }
      />

      <Breadcrumb
        items={[
          { title: <Link to="/apps">应用列表</Link> },
          { title: `应用 ${appId}` },
          { title: "数据列表" }
        ]}
      />

      <div className="metrics-grid">
        <Card className="metric-card" bordered={false}>
          <Statistic title="数据条数" value={rows.length} />
        </Card>
        <Card className="metric-card" bordered={false}>
          <Statistic title="当前表单数量" value={forms.length} />
        </Card>
      </div>

      <Card className="panel-card" bordered={false}>
        <Table rowKey="_id" loading={loading} dataSource={rows} columns={columns} />
      </Card>
    </Space>
  );
}

function DataFormPage({ mode }: { mode: "new" | "edit" }) {
  const { appId = "", dataId = "" } = useParams();
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [editorForm] = Form.useForm();
  const { forms, rows, load } = useAppData(appId);
  const [loading, setLoading] = React.useState(false);

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

  const runtimeSchema = React.useMemo(() => toRuntimeSchema(selectedForm), [selectedForm]);

  const save = async () => {
    if (!resolvedFormName) {
      api.error("当前应用没有可用 form");
      return;
    }
    const values = editorForm.getFieldsValue(true) as Record<string, unknown>;

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
        api.error(`保存失败: ${await res.text()}`);
        return;
      }

      api.success(mode === "new" ? "新增成功" : "修改成功");
      navigate(`/apps/${appId}/data`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {contextHolder}
      <PageHero
        title={`${mode === "new" ? "新增" : "编辑"}数据 · ${appId}`}
        subtitle="通过自动生成表单维护结构化数据，支持复杂对象字段。"
        actions={
          <Space>
            <Button onClick={() => navigate(`/apps/${appId}/data`)}>取消</Button>
            <Button type="primary" onClick={() => void save()} loading={loading}>
              保存
            </Button>
          </Space>
        }
      />

      <Breadcrumb
        items={[
          { title: <Link to="/apps">应用列表</Link> },
          { title: <Link to={`/apps/${appId}/data`}>数据列表</Link> },
          { title: mode === "new" ? "新增" : "编辑" }
        ]}
      />

      <Card className="panel-card" bordered={false}>
        {runtimeSchema ? (
          <FormRenderer form={editorForm} schema={runtimeSchema} />
        ) : (
          <Empty description="当前 form schema 不可用，无法生成表单" />
        )}
      </Card>
    </Space>
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
