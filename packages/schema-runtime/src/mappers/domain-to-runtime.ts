import type { DomainFormSchema, RuntimeFormSchema } from "@lowcode/shared-types";

export function domainToRuntime(input: DomainFormSchema): RuntimeFormSchema {
  return {
    formId: input.formName,
    version: input.version,
    fields: input.fields.map((field) => {
      const hasRequired = field.rules.some((rule) => rule.type === "required");
      const runtimeRules = hasRequired
        ? field.rules
        : field.required
          ? [{ type: "required" as const }, ...field.rules]
          : field.rules;

      const base = {
        id: field.key,
        componentType: field.fieldType,
        props: {
          label: field.label,
          options: field.options ?? [],
          itemType: field.itemType,
          objectFields: field.objectFields
        },
        rules: runtimeRules,
        ...(field.fieldType === "checkbox" || field.fieldType === "switch" ? { valuePropName: "checked" } : {})
      };

      if (!field.visibility?.expr) return base;
      return { ...base, visibleWhen: field.visibility.expr };
    })
  };
}
