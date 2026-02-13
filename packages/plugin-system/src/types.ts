export interface PluginContext {
  registerFieldType(type: string, def: unknown): void;
  registerValidationRule(type: string, fn: (value: unknown, ruleValue?: string) => boolean): void;
  registerRenderer(type: string, renderer: unknown): void;
  addHook(
    hook: "beforeSchemaSave" | "afterSchemaSave" | "beforeDataSubmit" | "afterDataSubmit",
    handler: (payload: unknown) => Promise<unknown> | unknown
  ): void;
}

export interface LowcodePlugin {
  name: string;
  register(ctx: PluginContext): void;
}
