import React from "react";
import {
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactDiffViewer from "react-diff-viewer";
import type { DomainFormSchema } from "@lowcode/shared-types";
import { API_BASE, TENANT, formatAppLabel } from "../constants";
import { useAppData } from "../hooks/use-app-data";
import { useAppsCatalog } from "../hooks/use-apps-catalog";
import { extractErrorMessage, toPrettyJson } from "../lib/http-utils";
import { formatListCellValue, toDomainSchema } from "../lib/schema-utils";
import type { DataItem } from "../types";

export function DataListPage() {
  const { appId = "" } = useParams();
  const apps = useAppsCatalog();
  const [api, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [showDeleted, setShowDeleted] = React.useState(false);
  const { forms, rows, loading, load } = useAppData(appId, showDeleted ? "deleted" : "active");
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

  const appLabel = React.useMemo(() => apps.find((app) => app.appId === appId)?.name || formatAppLabel(appId), [apps, appId]);

  const remove = async (id: string) => {
    const res = await fetch(`${API_BASE}/apps/${appId}/data/${id}`, { method: "DELETE", headers: { "x-tenant-id": TENANT } });
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
      return [...listData, JSON.stringify(row.data ?? {})].join(" ").toLowerCase().includes(keyword);
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
          <Input
            allowClear
            placeholder="搜索表格字段 / 数据内容"
            className="list-toolbar-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            suffix={<SearchOutlined />}
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
          <Typography.Text type="secondary">左侧是 DEV，右侧是 PRD，确认后会用 DEV 覆盖 PRD。</Typography.Text>
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
