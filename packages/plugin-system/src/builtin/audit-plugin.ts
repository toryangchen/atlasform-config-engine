import type { LowcodePlugin } from "../types";

export const auditPlugin: LowcodePlugin = {
  name: "audit-plugin",
  register(ctx) {
    ctx.registerValidationRule("trimmed", (value) => {
      if (typeof value !== "string") return true;
      return value.trim().length > 0;
    });

    ctx.addHook("beforeDataSubmit", (payload) => {
      return {
        ...((payload as Record<string, unknown>) ?? {}),
        _auditTs: new Date().toISOString()
      };
    });
  }
};
