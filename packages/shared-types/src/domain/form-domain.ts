export type RuleType = "required" | "min" | "max" | "pattern" | "custom";

export interface DomainValidationRule {
  type: RuleType;
  value?: string;
  plugin?: string;
}

export interface DomainFieldSchema {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  listInTable?: boolean;
  uniqueKey?: boolean;
  options?: Array<string | { label: string; value: string }>;
  itemType?: "string" | "number" | "boolean" | "object";
  objectFields?: DomainFieldSchema[];
  rules: DomainValidationRule[];
  visibility?: { expr: string };
  metadata?: Record<string, unknown>;
}

export interface DomainFormSchema {
  formName: string;
  version: string;
  tenantId?: string;
  status: "draft" | "published";
  fields: DomainFieldSchema[];
  createdAt: string;
}
