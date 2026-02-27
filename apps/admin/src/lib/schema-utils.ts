import { domainToRuntime } from "@lowcode/schema-runtime";
import type { DomainFieldSchema, DomainFormSchema, RuntimeFormSchema } from "@lowcode/shared-types";
import type { FormItem } from "../types";

export function extractSchemaRoot(raw: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw.fields)) return raw;
  if (raw.schema && typeof raw.schema === "object") return raw.schema as Record<string, unknown>;
  return raw;
}

export function normalizeOptions(input: unknown): Array<string | { label: string; value: string }> | null {
  if (!Array.isArray(input)) return null;
  const out: Array<string | { label: string; value: string }> = [];
  for (const item of input) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      if (typeof record.label === "string" && typeof record.value === "string") {
        out.push({ label: record.label, value: record.value });
      }
    }
  }
  return out.length > 0 ? out : null;
}

export function parseDomainField(raw: Record<string, unknown>): DomainFieldSchema | null {
  const key = typeof raw.key === "string" ? raw.key : typeof raw.name === "string" ? raw.name : null;
  if (!key) return null;

  const label = typeof raw.label === "string" ? raw.label : key;
  const fieldType =
    typeof raw.fieldType === "string"
      ? raw.fieldType
      : typeof raw.field_type === "string"
        ? raw.field_type
        : typeof raw.type === "string"
          ? raw.type
          : "string";
  const options = normalizeOptions(raw.options);
  const itemType =
    raw.itemType === "string" || raw.itemType === "number" || raw.itemType === "boolean" || raw.itemType === "object"
      ? raw.itemType
      : raw.item_type === "string" ||
          raw.item_type === "number" ||
          raw.item_type === "boolean" ||
          raw.item_type === "object"
        ? raw.item_type
        : undefined;
  const objectFieldsRaw =
    raw.objectFields ??
    raw.object_fields ??
    raw.fields ??
    raw.itemObjectFields ??
    raw.item_object_fields ??
    ((raw.metadata as Record<string, unknown> | undefined)?.objectFields ?? null);
  const listInTableRaw =
    raw.listInTable ??
    raw.list_in_table ??
    raw.listVisible ??
    raw.list_visible ??
    ((raw.metadata as Record<string, unknown> | undefined)?.listInTable ?? null);
  const listInTable = typeof listInTableRaw === "boolean" ? listInTableRaw : false;
  const uniqueKeyRaw =
    raw.uniqueKey ??
    raw.unique_key ??
    ((raw.metadata as Record<string, unknown> | undefined)?.uniqueKey ?? null);
  const uniqueKey = typeof uniqueKeyRaw === "boolean" ? uniqueKeyRaw : false;

  const objectFields = Array.isArray(objectFieldsRaw)
    ? objectFieldsRaw
        .map((item) => (item && typeof item === "object" ? parseDomainField(item as Record<string, unknown>) : null))
        .filter((item): item is DomainFieldSchema => Boolean(item))
    : undefined;

  const rules = Array.isArray(raw.rules)
    ? (raw.rules as Array<Record<string, unknown>>).map((r) => ({
        type: String(r.type ?? "custom") as DomainFieldSchema["rules"][number]["type"],
        ...(typeof r.value === "string" ? { value: r.value } : {})
      }))
    : [];

  return {
    key,
    label,
    fieldType,
    required: Boolean(raw.required),
    listInTable,
    uniqueKey,
    ...(options ? { options } : {}),
    ...(itemType ? { itemType } : {}),
    ...(objectFields && objectFields.length > 0 ? { objectFields } : {}),
    rules
  };
}

export function toDomainSchema(form: FormItem): DomainFormSchema | null {
  const raw = form.schema as Record<string, unknown>;
  const schemaRoot = extractSchemaRoot(raw);
  const rawFields = schemaRoot.fields;
  if (!Array.isArray(rawFields)) return null;

  const fields = rawFields
    .map((item) => (item && typeof item === "object" ? parseDomainField(item as Record<string, unknown>) : null))
    .filter((item): item is DomainFieldSchema => Boolean(item));

  return {
    formName: form.formName,
    version: form.version,
    status: form.status,
    createdAt: new Date().toISOString(),
    fields
  };
}

export function toRuntimeSchema(form: FormItem | undefined): RuntimeFormSchema | null {
  if (!form) return null;
  const domain = toDomainSchema(form);
  if (!domain) return null;
  const runtime = domainToRuntime(domain);

  runtime.fields = runtime.fields.map((field) => {
    if (field.componentType === "select" || field.componentType === "checkbox-group") {
      const normalizedOptions = normalizeOptions(field.props.options);
      return {
        ...field,
        props: {
          ...field.props,
          options: normalizedOptions ?? []
        }
      };
    }
    return field;
  });

  return runtime;
}

export function hasRenderableSchema(form: FormItem | undefined): boolean {
  if (!form) return false;
  const raw = form.schema as Record<string, unknown>;
  return Array.isArray(extractSchemaRoot(raw).fields);
}

export function formatListCellValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined) return "-";
  if (fieldType === "array<object>") {
    if (!Array.isArray(value)) return "-";
    if (value.length === 0) return "[]";
    const first = value[0];
    const head = first && typeof first === "object" ? JSON.stringify(first) : String(first);
    return `[${value.length}] ${head}`;
  }
  if (fieldType === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "-";
    return JSON.stringify(value);
  }
  if (fieldType === "array") {
    if (!Array.isArray(value)) return String(value);
    return value.join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
