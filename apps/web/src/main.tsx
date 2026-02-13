import React from "react";
import ReactDOM from "react-dom/client";
import { Checkbox, ConfigProvider, Input, InputNumber, Select } from "antd";
import "antd/dist/reset.css";
import { componentRegistry } from "@lowcode/component-registry";
import { FormRenderer, ObjectDrawerField } from "@lowcode/form-engine";
import { PluginManager, auditPlugin } from "@lowcode/plugin-system";
import { domainToRuntime } from "@lowcode/schema-runtime";
import type { DomainFormSchema } from "@lowcode/shared-types";
import { RuntimeProvider } from "./lowcode/runtime-context";
import { JsonArrayObjectField, StringArrayField } from "./lowcode/advanced-fields";

componentRegistry.registerComponent("string", Input);
componentRegistry.registerComponent("number", InputNumber);
componentRegistry.registerComponent("select", Select);
componentRegistry.registerComponent("checkbox", Checkbox);
componentRegistry.registerComponent("checkbox-group", Checkbox.Group);
componentRegistry.registerComponent("object", ObjectDrawerField);
componentRegistry.registerComponent("array", StringArrayField);
componentRegistry.registerComponent("array<object>", JsonArrayObjectField);

const pluginManager = new PluginManager();
pluginManager.use(auditPlugin);

const domainSchema: DomainFormSchema = {
  formName: "employee-onboarding",
  version: "1.0.0",
  status: "published",
  createdAt: new Date().toISOString(),
  fields: [
    {
      key: "name",
      label: "Name",
      fieldType: "string",
      required: true,
      rules: [{ type: "required" }]
    },
    {
      key: "age",
      label: "Age",
      fieldType: "number",
      required: false,
      rules: []
    },
    {
      key: "role",
      label: "Role",
      fieldType: "select",
      required: true,
      options: ["Engineer", "Designer", "PM"],
      rules: [{ type: "required" }]
    },
    {
      key: "agreePolicy",
      label: "Agree Policy",
      fieldType: "checkbox",
      required: true,
      rules: [{ type: "required" }]
    },
    {
      key: "skills",
      label: "Skills",
      fieldType: "checkbox-group",
      required: false,
      options: ["TypeScript", "React", "Node.js", "MongoDB"],
      rules: []
    },
    {
      key: "profile",
      label: "Profile Object",
      fieldType: "object",
      required: false,
      objectFields: [
        {
          key: "email",
          label: "Email",
          fieldType: "string",
          required: true,
          rules: [{ type: "required" }]
        },
        {
          key: "address",
          label: "Address",
          fieldType: "object",
          required: false,
          objectFields: [
            {
              key: "city",
              label: "City",
              fieldType: "string",
              required: true,
              rules: [{ type: "required" }]
            },
            {
              key: "zipcode",
              label: "Zip Code",
              fieldType: "string",
              required: false,
              rules: []
            },
            {
              key: "geo",
              label: "Geo",
              fieldType: "object",
              required: false,
              objectFields: [
                {
                  key: "lat",
                  label: "Latitude",
                  fieldType: "number",
                  required: false,
                  rules: []
                },
                {
                  key: "lng",
                  label: "Longitude",
                  fieldType: "number",
                  required: false,
                  rules: []
                }
              ],
              rules: []
            }
          ],
          rules: []
        }
      ],
      rules: []
    },
    {
      key: "tags",
      label: "Tags Array<string>",
      fieldType: "array",
      itemType: "string",
      required: false,
      rules: []
    },
    {
      key: "experiences",
      label: "Experiences Array<object>",
      fieldType: "array<object>",
      required: false,
      rules: []
    }
  ]
};

const runtimeSchema = domainToRuntime(domainSchema);
runtimeSchema.fields = runtimeSchema.fields.map((f) => {
  if (f.componentType === "select" || f.componentType === "checkbox-group") {
    return {
      ...f,
      props: {
        ...f.props,
        options: (f.props.options as string[]).map((v) => ({ label: v, value: v }))
      }
    };
  }
  return f;
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RuntimeProvider tenantId="demo-tenant" pluginManager={pluginManager}>
      <ConfigProvider>
        <div style={{ maxWidth: 680, margin: "40px auto", padding: 16 }}>
          <h1>Proto-Driven Lowcode Runtime</h1>
          <FormRenderer schema={runtimeSchema} />
        </div>
      </ConfigProvider>
    </RuntimeProvider>
  </React.StrictMode>
);
