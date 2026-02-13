import { z, type ZodTypeAny } from "zod";
import type { DomainFieldSchema, DomainFormSchema } from "@lowcode/shared-types";

function buildField(field: DomainFieldSchema): ZodTypeAny {
  let current: ZodTypeAny = z.any();

  if (field.fieldType === "string") current = z.string();
  if (field.fieldType === "number") current = z.number();

  for (const rule of field.rules) {
    if (field.fieldType === "string" && rule.type === "required") current = (current as z.ZodString).min(1);
    if (field.fieldType === "string" && rule.type === "min" && rule.value) current = (current as z.ZodString).min(Number(rule.value));
    if (field.fieldType === "string" && rule.type === "max" && rule.value) current = (current as z.ZodString).max(Number(rule.value));
    if (field.fieldType === "string" && rule.type === "pattern" && rule.value) current = (current as z.ZodString).regex(new RegExp(rule.value));
  }

  return field.required ? current : current.optional();
}

export function buildZodSchema(form: DomainFormSchema) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of form.fields) {
    shape[field.key] = buildField(field);
  }
  return z.object(shape);
}
