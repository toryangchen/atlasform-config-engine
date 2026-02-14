import React from "react";
import { Form } from "antd";
import { componentRegistry } from "@lowcode/component-registry";

type RawField = Record<string, unknown>;

export interface NestedField {
  id: string;
  label: string;
  componentType: string;
  required: boolean;
  options?: Array<string | { label: string; value: string }>;
  objectFields?: NestedField[];
  valuePropName?: string;
}

function normalizeOptions(input: unknown): Array<string | { label: string; value: string }> | undefined {
  if (!Array.isArray(input)) return undefined;
  return input
    .filter((item) => typeof item === "string" || (!!item && typeof item === "object"))
    .map((item) => {
      if (typeof item === "string") return { label: item, value: item };
      const obj = item as Record<string, unknown>;
      const label = typeof obj.label === "string" ? obj.label : String(obj.value ?? "");
      const value = typeof obj.value === "string" ? obj.value : String(obj.label ?? "");
      return { label, value };
    });
}

export function parseNestedFields(input: unknown): NestedField[] {
  if (!Array.isArray(input)) return [];

  const fields: NestedField[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const f = item as RawField;

    const idRaw = typeof f.key === "string" ? f.key : typeof f.name === "string" ? f.name : null;
    if (!idRaw) continue;

    const componentType =
      typeof f.fieldType === "string" ? f.fieldType : typeof f.type === "string" ? f.type : "string";
    const label = typeof f.label === "string" ? f.label : idRaw;
    const objectFieldsRaw = f.objectFields ?? f.fields ?? ((f.metadata as Record<string, unknown> | undefined)?.objectFields ?? null);
    const options = normalizeOptions(f.options);
    const nested = componentType === "object" ? parseNestedFields(objectFieldsRaw) : [];

    fields.push({
      id: idRaw,
      label,
      componentType,
      required: Boolean(f.required),
      ...(options ? { options } : {}),
      ...(componentType === "checkbox" ? { valuePropName: "checked" } : {}),
      ...(nested.length > 0 ? { objectFields: nested } : {})
    });
  }

  return fields;
}

export function formatPreviewValue(input: unknown): string {
  if (input === null || input === undefined) return "-";
  if (typeof input === "boolean") return input ? "true" : "false";
  if (typeof input === "number" || typeof input === "string") return String(input);
  if (Array.isArray(input)) return `[${input.length}]`;
  if (typeof input === "object") return "{...}";
  return String(input);
}

export const NestedFieldsRenderer: React.FC<{ fields: NestedField[] }> = ({ fields }) => {
  return (
    <>
      {fields.map((field) => {
        const Comp = componentRegistry.getComponent(field.componentType);

        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={field.label}
            rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
            {...(field.valuePropName ? { valuePropName: field.valuePropName } : {})}
          >
            <Comp
              label={field.label}
              {...(field.options ? { options: field.options } : {})}
              {...(field.objectFields ? { objectFields: field.objectFields } : {})}
            />
          </Form.Item>
        );
      })}
    </>
  );
};
