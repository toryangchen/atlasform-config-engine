export const API_BASE = "http://localhost:3000";
export const TENANT = "demo-tenant";

export function formatAppLabel(appId: string): string {
  return appId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
