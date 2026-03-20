import React from "react";
import { Button, Layout, Menu, Typography } from "antd";
import { AppstoreAddOutlined, DatabaseOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../constants";
import type { AppDefinition, ProtoDefinition } from "../types";

const { Header, Content, Sider } = Layout;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apps, setApps] = React.useState<AppDefinition[]>([]);
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

  const loadApps = React.useCallback(async () => {
    const res = await fetch(API_BASE);
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

  React.useEffect(() => {
    const appMatch = location.pathname.match(/^\/apps\/([^/]+)/);
    setOpenKeys(appMatch?.[1] ? [`app:${appMatch[1]}`] : []);
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
        <div className="header-left">
          <button type="button" className="header-home-btn" onClick={() => navigate("/apps")}>
            <div className="brand-mark">
              <DatabaseOutlined />
            </div>
            <div>
              <Typography.Text className="brand-title">AtlasForm Admin</Typography.Text>
              <Typography.Text className="brand-subtitle">配置与数据管理后台</Typography.Text>
            </div>
          </button>
        </div>
        <div className="header-right">
          <Button type="text" className="header-apps-entry" icon={<AppstoreAddOutlined />} onClick={() => navigate("/apps")}>
            应用管理
          </Button>
        </div>
      </Header>
      <Layout className="admin-body">
        <Sider className="admin-sider" width={252} theme="light" breakpoint="lg" collapsedWidth={0}>
          <div className="sider-heading">
            <Typography.Text className="sider-heading-title">应用导航</Typography.Text>
            <Typography.Text className="sider-heading-meta">{apps.length} 个应用</Typography.Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            items={menuItems}
            onClick={onMenuClick}
            className="app-menu"
          />
          <div className="sider-footer-note">
            <Typography.Text className="sider-footer-title">使用说明</Typography.Text>
            <Typography.Text className="sider-footer-copy">先选择应用，再进入 Proto 查看数据列表和表单。</Typography.Text>
          </div>
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
