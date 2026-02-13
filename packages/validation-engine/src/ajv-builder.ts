import Ajv from "ajv";
import type { DomainFormSchema } from "@lowcode/shared-types";

export function buildJsonSchema(form: DomainFormSchema) {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of form.fields) {
    const prop: Record<string, unknown> = {};
    prop.type = field.fieldType === "number" ? "number" : "string";

    for (const rule of field.rules) {
      if (rule.type === "min" && rule.value) prop.minLength = Number(rule.value);
      if (rule.type === "max" && rule.value) prop.maxLength = Number(rule.value);
      if (rule.type === "pattern" && rule.value) prop.pattern = rule.value;
    }

    if (field.required) required.push(field.key);
    properties[field.key] = prop;
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

export function buildAjvValidator(form: DomainFormSchema) {
  const ajv = new Ajv({ allErrors: true });
  return ajv.compile(buildJsonSchema(form));
}
