import React from "react";
import { API_BASE } from "../constants";
import type { AppDefinition } from "../types";

export function useAppsCatalog() {
  const [apps, setApps] = React.useState<AppDefinition[]>([]);

  React.useEffect(() => {
    const run = async () => {
      const res = await fetch(`${API_BASE}/apps`);
      setApps((await res.json()) as AppDefinition[]);
    };
    void run();
  }, []);

  return apps;
}
