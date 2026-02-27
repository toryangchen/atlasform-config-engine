export async function extractErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  if (!raw) return "请求失败";
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join("；");
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // fall through
  }
  return raw;
}

export function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "{}");
  }
}
