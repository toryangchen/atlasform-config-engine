import React from "react";
import { Breadcrumb, Button, Card, Empty, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined } from "@ant-design/icons";
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

  const columns: ColumnsType<AppDefinition> = [
    {
      title: "应用",
      key: "app",
      render: (_, app) => <Typography.Text strong>{app.name}</Typography.Text>
    },
    {
      title: "应用描述",
      dataIndex: "description",
      key: "description",
      render: (value: string) => <Typography.Text type="secondary">{value || "-"}</Typography.Text>
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
    return apps.filter((app) => [app.name, app.description, app.appId, app.protoFile].join(" ").toLowerCase().includes(keyword));
  }, [apps, query]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="sticky-page-module list-breadcrumb-bar">
        <Breadcrumb items={[{ title: "应用管理" }]} />
      </div>

      <Card className="panel-card" bordered={false}>
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
          locale={{ emptyText: <Empty description="暂无应用，请先添加 proto 文件" /> }}
        />
      </Card>
    </Space>
  );
}
