import React from "react";
import ReactDOM from "react-dom/client";
import "antd/dist/reset.css";
import "./styles.css";
import { AdminApp } from "./app";
import { setupComponentRegistry } from "./setup-component-registry";

setupComponentRegistry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
