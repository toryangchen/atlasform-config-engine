import React from "react";
import ReactDOM from "react-dom/client";
import { Alert, Checkbox, ConfigProvider, Empty, Input, InputNumber, Select as AntdSelect, Space, Spin, Switch as AntdSwitch, Typography } from "antd";
import "antd/dist/reset.css";
import { componentRegistry } from "@lowcode/component-registry";
import { ArrayObjectTableField, ArrayStringTableField, FormRenderer, ObjectDrawerField } from "@lowcode/form-engine";
import { PluginManager, auditPlugin } from "@lowcode/plugin-system";
import { domainToRuntime } from "@lowcode/schema-runtime";
import type { DomainFieldSchema, DomainFormSchema, RuntimeFormSchema } from "@lowcode/shared-types";
import { RuntimeProvider } from "./lowcode/runtime-context";

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
}

const API_BASE = "http://localhost:3000";
const TENANT = "demo-tenant";

componentRegistry.registerComponent("string", Input);
componentRegistry.registerComponent("textarea", Input.TextArea);
componentRegistry.registerComponent("markdown", Input.TextArea);
componentRegistry.registerComponent("json", Input.TextArea);
componentRegistry.registerComponent("number", InputNumber);
componentRegistry.registerComponent("select", AntdSelect);
componentRegistry.registerComponent("checkbox", Checkbox);
componentRegistry.registerComponent("checkbox-group", Checkbox.Group);
componentRegistry.registerComponent("switch", AntdSwitch);
componentRegistry.registerComponent("object", ObjectDrawerField);
componentRegistry.registerComponent("array", ArrayStringTableField);
componentRegistry.registerComponent("array<object>", ArrayObjectTableField);

const pluginManager = new PluginManager();
pluginManager.use(auditPlugin);

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

function RuntimeApp() {
  const [apps, setApps] = React.useState<AppDefinition[]>([]);
  const [selectedAppId, setSelectedAppId] = React.useState("");
  const [forms, setForms] = React.useState<FormItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const appsRes = await fetch(`${API_BASE}/apps`, { headers: { "x-tenant-id": TENANT } });
        if (!appsRes.ok) throw new Error(await appsRes.text());
        const appList = (await appsRes.json()) as AppDefinition[];
        setApps(appList);
        const appId = selectedAppId || appList[0]?.appId || "";
        setSelectedAppId(appId);
        if (!appId) {
          setForms([]);
          return;
        }
        const formsRes = await fetch(`${API_BASE}/apps/${appId}/forms`, { headers: { "x-tenant-id": TENANT } });
        if (!formsRes.ok) throw new Error(await formsRes.text());
        setForms((await formsRes.json()) as FormItem[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load runtime schema");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [selectedAppId]);

  const runtimeSchema = React.useMemo(() => toRuntimeSchema(forms[0]), [forms]);

  return (
    <div style={{ maxWidth: 820, margin: "32px auto", padding: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          AtlasForm Runtime
        </Typography.Title>
        <AntdSelect
          value={selectedAppId || null}
          options={apps.map((a) => ({ label: `${a.name} (${a.appId})`, value: a.appId }))}
          placeholder="Select app"
          onChange={(v) => setSelectedAppId(v)}
        />

        {loading ? <Spin /> : null}
        {!loading && error ? <Alert type="error" message="Load failed" description={error} showIcon /> : null}
        {!loading && !error && !runtimeSchema ? <Empty description="No renderable schema found for this app" /> : null}
        {!loading && !error && runtimeSchema ? <FormRenderer schema={runtimeSchema} /> : null}
      </Space>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RuntimeProvider tenantId="demo-tenant" pluginManager={pluginManager}>
      <ConfigProvider>
        <RuntimeApp />
      </ConfigProvider>
    </RuntimeProvider>
  </React.StrictMode>
);
