export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
export const TENANT = "demo-tenant";

export function formatAppLabel(appId: string): string {
  return appId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatProtoLabel(protoId: string): string {
  return formatAppLabel(protoId);
}
