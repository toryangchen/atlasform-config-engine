import React from "react";
import { Button, Layout, Menu, Typography } from "antd";
import { AppstoreAddOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../constants";
import type { AppDefinition } from "../types";

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
    const match = location.pathname.match(/^\/apps\/([^/]+)/);
    if (!match?.[1]) return "";
    return `app:${match[1]}`;
  }, [location.pathname]);

  const menuItems = React.useMemo(() => apps.map((app) => ({ key: `app:${app.appId}`, label: app.name })), [apps]);

  const onMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith("app:")) navigate(`/apps/${key.slice(4)}/data`);
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
