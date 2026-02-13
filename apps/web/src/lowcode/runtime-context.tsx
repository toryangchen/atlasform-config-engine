import React, { createContext, useContext } from "react";
import { PluginManager } from "@lowcode/plugin-system";

export interface RuntimeContextValue {
  tenantId: string;
  pluginManager: PluginManager;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export const RuntimeProvider: React.FC<React.PropsWithChildren<RuntimeContextValue>> = ({ children, ...value }) => {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
};

export function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("RuntimeContext not found");
  return ctx;
}
