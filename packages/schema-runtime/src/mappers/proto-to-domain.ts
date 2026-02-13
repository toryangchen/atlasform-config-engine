import type { DomainFormSchema, FormSchema } from "@lowcode/shared-types";

export function protoToDomain(input: FormSchema): DomainFormSchema {
  return {
    formName: input.formName,
    version: input.version,
    status: "draft",
    createdAt: new Date().toISOString(),
    fields: input.fields.map((f) => ({
      key: f.name,
      label: f.label,
      fieldType: f.type,
      required: f.required,
      options: f.options,
      rules: (f.rules ?? []).map((r) => ({
        type: (r.type || "custom") as DomainFormSchema["fields"][number]["rules"][number]["type"],
        value: r.value
      }))
    }))
  };
}
