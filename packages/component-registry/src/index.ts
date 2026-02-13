import type React from "react";

export type LowcodeComponent = React.FC<any>;

class ComponentRegistry {
  private store = new Map<string, LowcodeComponent>();

  registerComponent(type: string, component: LowcodeComponent): void {
    this.store.set(type, component);
  }

  getComponent(type: string): LowcodeComponent {
    const comp = this.store.get(type);
    if (!comp) {
      throw new Error(`Component not found for type: ${type}`);
    }
    return comp;
  }
}

export const componentRegistry = new ComponentRegistry();
