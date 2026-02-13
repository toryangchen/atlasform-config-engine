export interface RuntimeFieldSchema {
  id: string;
  componentType: string;
  props: Record<string, unknown>;
  rules: Array<{ type: string; value?: string }>;
  visibleWhen?: string;
  valuePropName?: string;
}

export interface RuntimeFormSchema {
  formId: string;
  version: string;
  fields: RuntimeFieldSchema[];
}
