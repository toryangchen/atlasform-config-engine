import React from "react";
import { Breadcrumb, Button, Card, Empty, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { AppstoreAddOutlined, BranchesOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../constants";
import type { AppDefinition } from "../types";

export function AppsPage() {
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

  const totalProtos = React.useMemo(() => apps.reduce((sum, app) => sum + app.protos.length, 0), [apps]);
  const densestApp = React.useMemo(() => [...apps].sort((left, right) => right.protos.length - left.protos.length)[0], [apps]);

  const columns: ColumnsType<AppDefinition> = [
    {
      title: "应用",
      key: "app",
      render: (_, app) => (
        <div className="primary-cell">
          <Typography.Text strong>{app.name}</Typography.Text>
          <Typography.Text type="secondary">{app.appId}</Typography.Text>
        </div>
      )
    },
    {
      title: "应用描述",
      dataIndex: "description",
      key: "description",
      render: (value: string) => <Typography.Text type="secondary">{value || "-"}</Typography.Text>
    },
    {
      title: "Proto 数量",
      key: "protoCount",
      width: 120,
      render: (_, app) => <Typography.Text>{app.protos.length}</Typography.Text>
    },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, app) => (
        <Space>
          <Button type="primary" ghost onClick={() => navigate(`/apps/${app.appId}/protos`)}>
            查看 Proto
          </Button>
        </Space>
      )
    }
  ];

  const filteredApps = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return apps;
    return apps.filter((app) =>
      [app.name, app.description, app.appId, ...app.protos.map((proto) => [proto.name, proto.description, proto.protoId, proto.protoFile].join(" "))]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [apps, query]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="sticky-page-module list-breadcrumb-bar">
        <Breadcrumb items={[{ title: "应用管理" }]} />
      </div>

      <div className="status-strip">
        <div className="status-strip-item">
          <AppstoreAddOutlined />
          <span className="status-strip-label">应用总数</span>
          <span className="status-strip-value">{apps.length}</span>
        </div>
        <div className="status-strip-item">
          <BranchesOutlined />
          <span className="status-strip-label">Proto 总数</span>
          <span className="status-strip-value">{totalProtos}</span>
        </div>
        <div className="status-strip-item">
          <span className="status-strip-label">Proto 最多的应用</span>
          <span className="status-strip-value">{densestApp ? `${densestApp.name} / ${densestApp.protos.length}` : "-"}</span>
        </div>
      </div>

      <Card className="panel-card" bordered={false}>
        <Typography.Paragraph className="page-description list-panel-description">
          查看所有应用、关联 Proto，以及进入具体数据维护入口。
        </Typography.Paragraph>
        <div className="list-toolbar">
          <Input
            allowClear
            placeholder="搜索 应用名 / 应用描述 / appId / proto 文件"
            className="list-toolbar-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            suffix={<SearchOutlined />}
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
          className="data-table"
          locale={{ emptyText: <Empty description="暂无应用，请先添加 proto 文件" /> }}
        />
      </Card>
    </Space>
  );
}
