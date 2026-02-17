import React from "react";
import { Form } from "antd";
import type { FormInstance } from "antd";
import type { Rule } from "antd/es/form";
import { componentRegistry } from "@lowcode/component-registry";
import type { RuntimeFormSchema } from "@lowcode/shared-types";

function evalVisible(expr: string | undefined, values: Record<string, unknown>): boolean {
  if (!expr) return true;
  try {
    return Function("values", `return !!(${expr})`)(values) as boolean;
  } catch {
    return false;
  }
}

export interface FormRendererProps {
  schema: RuntimeFormSchema;
  form?: FormInstance;
  initialValues?: Record<string, unknown>;
  onValuesChange?: (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => void;
}

function toAntdRules(
  rules: Array<{ type: string; value?: string }>,
  label: string,
  componentType: string
): Rule[] {
  return rules
    .map((rule): Rule | null => {
      if (rule.type === "required") {
        if (componentType === "switch" || componentType === "checkbox") {
          return {
            validator: async (_, value) => {
              if (value === true) return;
              throw new Error(`${label} is required`);
            }
          };
        }
        if (componentType === "checkbox-group") {
          return {
            validator: async (_, value) => {
              if (Array.isArray(value) && value.length > 0) return;
              throw new Error(`${label} is required`);
            }
          };
        }
        if (componentType === "array" || componentType === "array<object>") {
          return {
            validator: async (_, value) => {
              if (Array.isArray(value) && value.length > 0) return;
              throw new Error(`${label} is required`);
            }
          };
        }
        if (componentType === "object") {
          return {
            validator: async (_, value) => {
              if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0) return;
              throw new Error(`${label} is required`);
            }
          };
        }
        return { required: true, message: `${label} is required` };
      }
      if (rule.type === "pattern") return { pattern: new RegExp(rule.value ?? ""), message: `${label} format is invalid` };
      if (rule.type === "min") return { min: Number(rule.value ?? "0"), message: `${label} is too short` };
      if (rule.type === "max") return { max: Number(rule.value ?? "0"), message: `${label} is too long` };
      return null;
    })
    .filter((item): item is Rule => Boolean(item));
}

export const FormRenderer: React.FC<FormRendererProps> = ({ schema, form: externalForm, initialValues, onValuesChange }) => {
  const [internalForm] = Form.useForm();
  const form = externalForm ?? internalForm;
  const values = Form.useWatch([], form) ?? {};

  return (
    <Form
      form={form}
      layout="vertical"
      {...(initialValues ? { initialValues } : {})}
      {...(onValuesChange ? { onValuesChange } : {})}
    >
      {schema.fields.map((field) => {
        if (!evalVisible(field.visibleWhen, values)) return null;
        const Comp = componentRegistry.getComponent(field.componentType);

        return (
          <Form.Item
            key={field.id}
            name={field.id}
            label={String(field.props.label ?? field.id)}
            {...(field.valuePropName ? { valuePropName: field.valuePropName } : {})}
            rules={toAntdRules(field.rules ?? [], String(field.props.label ?? field.id), field.componentType)}
          >
            <Comp {...field.props} />
          </Form.Item>
        );
      })}
    </Form>
  );
};

export { ObjectDrawerField } from "./object-drawer-field";
export { ArrayStringTableField } from "./array-string-table-field";
export { ArrayObjectTableField } from "./array-object-table-field";
