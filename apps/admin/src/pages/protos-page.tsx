import React from "react";
import { Breadcrumb, Button, Card, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined } from "@ant-design/icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatAppLabel } from "../constants";
import { useAppsCatalog } from "../hooks/use-apps-catalog";
import type { ProtoDefinition } from "../types";

export function ProtosPage() {
  const { appId = "" } = useParams();
  const apps = useAppsCatalog();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");

  const app = React.useMemo(() => apps.find((item) => item.appId === appId), [apps, appId]);
  const appLabel = app?.name || formatAppLabel(appId);

  const columns: ColumnsType<ProtoDefinition> = [
    {
      title: "Proto",
      key: "proto",
      render: (_, proto) => <Typography.Text strong>{proto.name}</Typography.Text>
    },
    {
      title: "Proto 描述",
      dataIndex: "description",
      key: "description",
      render: (value: string) => <Typography.Text type="secondary">{value || "-"}</Typography.Text>
    },
    {
      title: "Proto ID",
      dataIndex: "protoId",
      key: "protoId",
      width: 180,
      render: (value: string) => <Tag>{value}</Tag>
    },
    {
      title: "Proto 文件",
      dataIndex: "protoFile",
      key: "protoFile"
    },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, proto) => (
        <Button type="primary" ghost onClick={() => navigate(`/apps/${appId}/protos/${proto.protoId}/data`)}>
          进入
        </Button>
      )
    }
  ];

  const filteredProtos = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const protos = app?.protos ?? [];
    if (!keyword) return protos;
    return protos.filter((proto) =>
      [proto.name, proto.description, proto.protoId, proto.protoFile].join(" ").toLowerCase().includes(keyword)
    );
  }, [app, query]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="sticky-page-module list-breadcrumb-bar">
        <Breadcrumb
          items={[
            { title: <Link to="/apps">应用管理</Link> },
            { title: `Proto 管理(${appLabel || appId})` }
          ]}
        />
      </div>

      <Card className="panel-card" bordered={false}>
        <div className="list-toolbar">
          <Input
            allowClear
            placeholder="搜索 Proto 名 / Proto 描述 / protoId / 文件路径"
            className="list-toolbar-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            suffix={<SearchOutlined />}
          />
          <Space className="list-toolbar-actions">
            <Button onClick={() => setQuery("")}>清空</Button>
          </Space>
        </div>
        <Table
          rowKey="protoId"
          dataSource={filteredProtos}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="当前应用下暂无 proto" /> }}
        />
      </Card>
    </Space>
  );
}
