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
  options?: string[];
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
