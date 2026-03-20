import React from "react";
import { API_BASE, TENANT } from "../constants";
import type { DataScope, FormItem, DataItem } from "../types";

export function useAppData(appId: string, protoId: string, scope: DataScope = "active") {
  const [forms, setForms] = React.useState<FormItem[]>([]);
  const [rows, setRows] = React.useState<DataItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!appId || !protoId) return;
    setLoading(true);
    try {
      const [formsRes, dataRes] = await Promise.all([
        fetch(`${API_BASE}/${appId}/protos/${protoId}/forms`, { headers: { "x-tenant-id": TENANT } }),
        fetch(`${API_BASE}/${appId}/protos/${protoId}/data?scope=${scope}`, { headers: { "x-tenant-id": TENANT } })
      ]);
      setForms((await formsRes.json()) as FormItem[]);
      setRows((await dataRes.json()) as DataItem[]);
    } finally {
      setLoading(false);
    }
  }, [appId, protoId, scope]);

  return { forms, rows, loading, load };
}
