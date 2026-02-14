import React from "react";
import { Form } from "antd";
import type { FormInstance } from "antd";
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
