import React from "react";
import { ConfigProvider } from "antd";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { AppsPage } from "./pages/apps-page";
import { DataFormPage } from "./pages/data-form-page";
import { DataListPage } from "./pages/data-list-page";

export function AdminApp() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0a84ff",
          colorInfo: "#0a84ff",
          borderRadius: 14,
          colorBgContainer: "#ffffff"
        }
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/apps" replace />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/:appId/data" element={<DataListPage />} />
            <Route path="/apps/:appId/data/new" element={<DataFormPage mode="new" />} />
            <Route path="/apps/:appId/data/:dataId/edit" element={<DataFormPage mode="edit" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
