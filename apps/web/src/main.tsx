import React from "react";
import ReactDOM from "react-dom/client";
import { Alert, Button, Card, Checkbox, ConfigProvider, Empty, Form, Input, InputNumber, Modal, Select as AntdSelect, Space, Switch as AntdSwitch, Typography } from "antd";
import "antd/dist/reset.css";
import { componentRegistry } from "@lowcode/component-registry";
import { ArrayObjectTableField, ArrayStringTableField, FormRenderer, MultiImageUploadField, ObjectDrawerField, SingleImageUploadField } from "@lowcode/form-engine";
import { PluginManager, auditPlugin } from "@lowcode/plugin-system";
import { domainToRuntime } from "@lowcode/schema-runtime";
import type { DomainFieldSchema, DomainFormSchema, RuntimeFormSchema } from "@lowcode/shared-types";
import { generatedManifest } from "../../../packages/shared-types/src/generated/lowcode-manifest";
import { RuntimeProvider } from "./lowcode/runtime-context";

interface AppDefinition {
  appId: string;
  name: string;
  description: string;
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
componentRegistry.registerComponent("image", SingleImageUploadField);
componentRegistry.registerComponent("array-image", MultiImageUploadField);

const pluginManager = new PluginManager();
pluginManager.use(auditPlugin);
const LOCAL_SOURCE: { apps: AppDefinition[]; formsByApp: Record<string, FormItem[]> } = {
  apps: [...generatedManifest.apps] as unknown as AppDefinition[],
  formsByApp: { ...generatedManifest.formsByApp } as unknown as Record<string, FormItem[]>
};
const protoTextModules = import.meta.glob("../../../packages/proto-core/proto/*.proto", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;
const protoTextByApp = Object.fromEntries(
  Object.entries(protoTextModules).map(([path, raw]) => {
    const file = path.split("/").pop() ?? "";
    const appId = file.replace(/\.proto$/i, "");
    return [appId, raw];
  })
) as Record<string, string>;

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
      const options = normalizeOptions(field.props.options);
      return {
        ...field,
        props: {
          ...field.props,
          options: (options ?? []).map((item) => (typeof item === "string" ? { label: item, value: item } : item))
        }
      };
    }
    return field;
  });

  return runtime;
}

function RuntimeApp() {
  const [form] = Form.useForm();
  const [selectedAppId, setSelectedAppId] = React.useState(LOCAL_SOURCE.apps[0]?.appId ?? "");
  const [jsonPreviewOpen, setJsonPreviewOpen] = React.useState(false);
  const [jsonPreview, setJsonPreview] = React.useState("{}");
  const forms = selectedAppId ? (LOCAL_SOURCE.formsByApp[selectedAppId] ?? []) : [];
  const runtimeSchema = React.useMemo(() => toRuntimeSchema(forms[0]), [forms]);
  const selectedApp = React.useMemo(() => LOCAL_SOURCE.apps.find((app) => app.appId === selectedAppId), [selectedAppId]);
  const protoSource = selectedAppId ? (protoTextByApp[selectedAppId] ?? "") : "";
  const protoLines = React.useMemo(() => (protoSource ? protoSource.split("\n") : []), [protoSource]);
  const NAV_HEIGHT = 64;

  const handleSave = React.useCallback(async () => {
    try {
      const values = await form.validateFields();
      setJsonPreview(JSON.stringify(values, null, 2));
      setJsonPreviewOpen(true);
    } catch {
      // antd will display field errors
    }
  }, [form]);

  const handleCloseJsonPreview = React.useCallback(() => {
    setJsonPreviewOpen(false);
  }, []);

  return (
    <div style={{ width: "100%", padding: "0 16px 24px", minHeight: "100vh" }}>
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            height: NAV_HEIGHT,
            display: "flex",
            alignItems: "center"
          }}
        >
          <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}>
            <Space style={{ justifyContent: "space-between", width: "100%" }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                AtlasForm Config Engine (Runtime Demo)
              </Typography.Title>
              <AntdSelect
                style={{ minWidth: 280 }}
                value={selectedAppId || null}
                options={LOCAL_SOURCE.apps.map((a) => ({ label: `${a.name} (${a.appId})`, value: a.appId }))}
                placeholder="Select app"
                onChange={(v) => setSelectedAppId(v)}
              />
            </Space>
          </div>
        </div>
        <div style={{ height: NAV_HEIGHT }} />
        <Alert
          type="info"
          showIcon
          message="在 Git 中修改 .proto 并执行 proto:gen 后，重新部署即可看到表单结构变化。当前 Demo 不与后端交互，不会存储任何用户提交的表单数据。"
          style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}
        />
        <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(380px, 1fr) minmax(420px, 1fr)",
            gap: 16,
            alignItems: "start"
          }}
        >
          <Card
            title={`Proto Source${selectedApp ? ` · ${selectedApp.protoFile}` : ""}`}
            styles={{ body: { padding: 0 } }}
            style={{ boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}
          >
            {!protoSource ? (
              <div style={{ padding: 16 }}>
                <Empty description="No proto source found for selected app" />
              </div>
            ) : (
              <div
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderTop: "1px solid #1e293b",
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 8
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                    lineHeight: 1.7
                  }}
                >
                  <div style={{ background: "#0b1220", color: "#64748b", textAlign: "right", padding: "14px 10px", userSelect: "none" }}>
                    {protoLines.map((_, index) => (
                      <div key={`line-no-${index + 1}`}>{index + 1}</div>
                    ))}
                  </div>
                  <pre style={{ margin: 0, padding: "14px 16px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    <code>{protoSource}</code>
                  </pre>
                </div>
              </div>
            )}
          </Card>

          <Card
            title={`Rendered Form${selectedApp ? ` · ${selectedApp.name}` : ""}`}
            extra={
              <Button type="primary" onClick={() => void handleSave()} disabled={!runtimeSchema}>
                预览表单json
              </Button>
            }
            style={{ boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}
          >
            {selectedApp ? (
              <Space direction="vertical" size={2} style={{ width: "100%", marginBottom: 12 }}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {selectedApp.name}
                </Typography.Title>
                <Typography.Text type="secondary">{selectedApp.description}</Typography.Text>
              </Space>
            ) : null}
            {!runtimeSchema ? <Empty description="No renderable schema found" /> : <FormRenderer schema={runtimeSchema} form={form} />}
          </Card>
        </div>
        </div>
      </Space>
      <Modal
        title="当前表单 JSON"
        open={jsonPreviewOpen}
        onCancel={handleCloseJsonPreview}
        footer={null}
        width={760}
      >
        <div style={{ height: "min(68vh, 620px)", overflow: "auto" }}>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              overflow: "auto",
              minHeight: "100%"
            }}
          >
            <code>{jsonPreview}</code>
          </pre>
        </div>
      </Modal>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RuntimeProvider tenantId={TENANT} pluginManager={pluginManager}>
      <ConfigProvider>
        <RuntimeApp />
      </ConfigProvider>
    </RuntimeProvider>
  </React.StrictMode>
);
