import React from "react";
import { ConfigProvider } from "antd";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { AppsPage } from "./pages/apps-page";
import { DataFormPage } from "./pages/data-form-page";
import { DataListPage } from "./pages/data-list-page";
import { ProtosPage } from "./pages/protos-page";

export function AdminApp() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1457ff",
          colorInfo: "#1457ff",
          colorSuccess: "#0f9f6f",
          colorWarning: "#f08c00",
          colorTextBase: "#18212f",
          colorBgContainer: "#ffffff",
          colorBorderSecondary: "rgba(73, 92, 122, 0.18)",
          borderRadius: 16,
          fontFamily: '"SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif'
        },
        components: {
          Button: {
            controlHeight: 40,
            fontWeight: 600
          },
          Card: {
            bodyPadding: 20
          },
          Table: {
            headerBorderRadius: 14
          }
        }
      }}
    >
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/apps" replace />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/:appId/protos" element={<ProtosPage />} />
            <Route path="/apps/:appId/protos/:protoId/data" element={<DataListPage />} />
            <Route path="/apps/:appId/protos/:protoId/data/new" element={<DataFormPage mode="new" />} />
            <Route path="/apps/:appId/protos/:protoId/data/:dataId/edit" element={<DataFormPage mode="edit" />} />
          </Route>
        </Routes>
      </HashRouter>
    </ConfigProvider>
  );
}
