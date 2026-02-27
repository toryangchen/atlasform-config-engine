import { Checkbox, Input, InputNumber, Select, Switch } from "antd";
import { componentRegistry } from "@lowcode/component-registry";
import { ArrayObjectTableField, ArrayStringTableField, MultiImageUploadField, ObjectDrawerField, SingleImageUploadField } from "@lowcode/form-engine";

let initialized = false;

export function setupComponentRegistry() {
  if (initialized) return;
  initialized = true;

  componentRegistry.registerComponent("string", Input);
  componentRegistry.registerComponent("textarea", Input.TextArea);
  componentRegistry.registerComponent("markdown", Input.TextArea);
  componentRegistry.registerComponent("json", Input.TextArea);
  componentRegistry.registerComponent("number", InputNumber);
  componentRegistry.registerComponent("select", Select);
  componentRegistry.registerComponent("checkbox", Checkbox);
  componentRegistry.registerComponent("checkbox-group", Checkbox.Group);
  componentRegistry.registerComponent("switch", Switch);
  componentRegistry.registerComponent("object", ObjectDrawerField);
  componentRegistry.registerComponent("array", ArrayStringTableField);
  componentRegistry.registerComponent("array<object>", ArrayObjectTableField);
  componentRegistry.registerComponent("image", SingleImageUploadField);
  componentRegistry.registerComponent("array-image", MultiImageUploadField);
}
