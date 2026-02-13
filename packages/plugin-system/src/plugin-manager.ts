import type { LowcodePlugin, PluginContext } from "./types";

export class PluginManager {
  private fieldTypes = new Map<string, unknown>();
  private validators = new Map<string, (value: unknown, ruleValue?: string) => boolean>();
  private renderers = new Map<string, unknown>();
  private hooks = new Map<string, Array<(payload: unknown) => Promise<unknown> | unknown>>();

  private ctx: PluginContext = {
    registerFieldType: (type, def) => {
      this.fieldTypes.set(type, def);
    },
    registerValidationRule: (type, fn) => {
      this.validators.set(type, fn);
    },
    registerRenderer: (type, renderer) => {
      this.renderers.set(type, renderer);
    },
    addHook: (hook, handler) => {
      const list = this.hooks.get(hook) ?? [];
      list.push(handler);
      this.hooks.set(hook, list);
    }
  };

  use(plugin: LowcodePlugin): void {
    plugin.register(this.ctx);
  }

  getRenderer(type: string): unknown {
    return this.renderers.get(type);
  }

  getValidator(type: string): ((value: unknown, ruleValue?: string) => boolean) | undefined {
    return this.validators.get(type);
  }

  async runHook(hook: string, payload: unknown): Promise<unknown> {
    const handlers = this.hooks.get(hook) ?? [];
    let current = payload;
    for (const handler of handlers) {
      current = await handler(current);
    }
    return current;
  }
}
