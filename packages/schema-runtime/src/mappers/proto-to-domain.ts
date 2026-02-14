import type { DomainFieldSchema, DomainFormSchema } from "@lowcode/shared-types";

interface ProtoRuleLike {
  type?: string;
  value?: string;
}

interface ProtoFieldLike {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  options?: string[];
  rules?: ProtoRuleLike[];
  itemType?: string;
  item_type?: string;
  objectFields?: ProtoFieldLike[];
  object_fields?: ProtoFieldLike[];
  itemObjectFields?: ProtoFieldLike[];
  item_object_fields?: ProtoFieldLike[];
}

interface ProtoSchemaLike {
  formName?: string;
  form_name?: string;
  version?: string;
  fields?: ProtoFieldLike[];
}

function mapField(f: ProtoFieldLike): DomainFieldSchema {
  const itemType = f.itemType ?? f.item_type;
  const objectFieldsRaw = f.objectFields ?? f.object_fields ?? f.itemObjectFields ?? f.item_object_fields;
  const out: DomainFieldSchema = {
    key: f.name,
    label: f.label ?? f.name,
    fieldType: f.type,
    required: Boolean(f.required),
    rules: (f.rules ?? []).map((r) => ({
      type: (r.type || "custom") as DomainFieldSchema["rules"][number]["type"],
      ...(r.value ? { value: r.value } : {})
    }))
  };

  if (Array.isArray(f.options)) out.options = f.options;
  if (itemType === "string" || itemType === "number" || itemType === "boolean" || itemType === "object") {
    out.itemType = itemType;
  }
  if (Array.isArray(objectFieldsRaw)) out.objectFields = objectFieldsRaw.map(mapField);

  return out;
}

export function protoToDomain(input: ProtoSchemaLike): DomainFormSchema {
  return {
    formName: input.formName ?? input.form_name ?? "proto_form",
    version: input.version ?? "1.0.0",
    status: "draft",
    createdAt: new Date().toISOString(),
    fields: (input.fields ?? []).map(mapField)
  };
}
