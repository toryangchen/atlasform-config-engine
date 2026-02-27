import React from "react";
import { Breadcrumb, Button, Card, Empty, Form, Space, message } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormRenderer } from "@lowcode/form-engine";
import { API_BASE, TENANT, formatAppLabel } from "../constants";
import { useAppData } from "../hooks/use-app-data";
import { useAppsCatalog } from "../hooks/use-apps-catalog";
import { extractErrorMessage } from "../lib/http-utils";
import { hasRenderableSchema, toRuntimeSchema } from "../lib/schema-utils";

export function DataFormPage({ mode }: { mode: "new" | "edit" }) {
  const { appId = "", dataId = "" } = useParams();
  const apps = useAppsCatalog();
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [editorForm] = Form.useForm();
  const { forms, rows, load } = useAppData(appId, "all");
  const [loading, setLoading] = React.useState(false);

  const appLabel = React.useMemo(() => apps.find((app) => app.appId === appId)?.name || formatAppLabel(appId), [apps, appId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const editingRow = React.useMemo(() => rows.find((r) => r._id === dataId), [rows, dataId]);

  React.useEffect(() => {
    if (mode !== "edit" || !editingRow) return;
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
