import type { DomainFormSchema, RuntimeFormSchema } from "@lowcode/shared-types";

export function domainToRuntime(input: DomainFormSchema): RuntimeFormSchema {
  return {
    formId: input.formName,
    version: input.version,
    fields: input.fields.map((field) => {
      const base = {
        id: field.key,
        componentType: field.fieldType,
        props: {
          label: field.label,
          options: field.options ?? [],
          itemType: field.itemType,
          objectFields: field.objectFields
        },
        rules: field.rules,
        ...(field.fieldType === "checkbox" ? { valuePropName: "checked" } : {})
      };

      if (!field.visibility?.expr) return base;
      return { ...base, visibleWhen: field.visibility.expr };
    })
  };
}
