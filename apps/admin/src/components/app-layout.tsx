import React from "react";
import { Button, Layout, Menu, Typography } from "antd";
import { AppstoreAddOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../constants";
import type { AppDefinition, ProtoDefinition } from "../types";

const { Header, Content, Sider } = Layout;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apps, setApps] = React.useState<AppDefinition[]>([]);

  const loadApps = React.useCallback(async () => {
    const res = await fetch(`${API_BASE}/apps`);
    setApps((await res.json()) as AppDefinition[]);
  }, []);

  React.useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const selectedKey = React.useMemo(() => {
    const appMatch = location.pathname.match(/^\/apps\/([^/]+)\/protos$/);
    if (appMatch?.[1]) return `app:${appMatch[1]}`;
    const match = location.pathname.match(/^\/apps\/([^/]+)\/protos\/([^/]+)/);
    if (!match?.[1] || !match?.[2]) return "";
    return `proto:${match[1]}:${match[2]}`;
  }, [location.pathname]);

  const openKeys = React.useMemo(() => {
    const appMatch = location.pathname.match(/^\/apps\/([^/]+)/);
    return appMatch?.[1] ? [`app:${appMatch[1]}`] : [];
  }, [location.pathname]);

  const menuItems = React.useMemo(
    () =>
      apps.map((app) => ({
        key: `app:${app.appId}`,
        label: app.name,
        children: app.protos.map((proto: ProtoDefinition) => ({
          key: `proto:${app.appId}:${proto.protoId}`,
          label: proto.name
        }))
      })),
    [apps]
  );

  const onMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith("app:")) {
      navigate(`/apps/${key.slice(4)}/protos`);
      return;
    }
    if (key.startsWith("proto:")) {
      const [, appId, protoId] = key.split(":");
      if (!appId || !protoId) return;
      navigate(`/apps/${appId}/protos/${protoId}/data`);
    }
  };

  return (
    <Layout className="admin-shell">
      <Header className="admin-header sticky-top">
        <button type="button" className="header-left header-home-btn" onClick={() => navigate("/apps")}>
          <div className="brand-dot" />
          <Typography.Text className="brand-title">AtlasForm Config Engine</Typography.Text>
        </button>
        <div className="header-right">
          <Button type="text" className="header-apps-entry" icon={<AppstoreAddOutlined />} onClick={() => navigate("/apps")}>
            应用管理
          </Button>
        </div>
      </Header>
      <Layout className="admin-body">
        <Sider className="admin-sider" width={252} theme="light" breakpoint="lg" collapsedWidth={0}>
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            openKeys={openKeys}
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
