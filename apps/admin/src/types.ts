export interface AppDefinition {
  appId: string;
  name: string;
  description: string;
  protoFile: string;
}

export interface FormItem {
  _id: string;
  appId: string;
  formName: string;
  version: string;
  status: "draft" | "published";
  schema: Record<string, unknown>;
  updatedAt: string;
}

export interface DataItem {
  _id: string;
  appId: string;
  formName: string;
  version: string;
  data: Record<string, unknown>;
  prdFormName?: string;
  prdVersion?: string;
  prdData?: Record<string, unknown>;
  prdUpdatedAt?: string;
  published?: boolean;
  deletedAt?: string;
  deleted?: boolean;
  updatedAt: string;
}

export type DataScope = "active" | "deleted" | "all";
