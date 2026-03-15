import { Dirent, existsSync, readdirSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

export interface ProtoCatalogEntry {
  appId: string;
  protoId: string;
  fileName: string;
  fullPath: string;
  relativePath: string;
  legacyFlat: boolean;
}

export function resolveProtoDir(): string | null {
  const candidates = [
    resolve(process.cwd(), "../../packages/proto-core/proto"),
    resolve(process.cwd(), "../packages/proto-core/proto"),
    resolve(process.cwd(), "packages/proto-core/proto")
  ];

  const hit = candidates.find((dir) => existsSync(dir));
  return hit ?? null;
}

export function listBusinessProtoFiles(protoDir: string): ProtoCatalogEntry[] {
  const entries: ProtoCatalogEntry[] = [];
  const rootEntries = readdirSync(protoDir, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (isHidden(entry.name)) continue;

    if (entry.isDirectory()) {
      if (entry.name === "common") continue;
      const appId = entry.name;
      const childEntries = readdirSync(resolve(protoDir, appId), { withFileTypes: true });
      for (const child of childEntries) {
        if (!child.isFile() || !child.name.endsWith(".proto") || isHidden(child.name)) continue;
        const fullPath = resolve(protoDir, appId, child.name);
        entries.push({
          appId,
          protoId: basename(child.name, ".proto"),
          fileName: child.name,
          fullPath,
          relativePath: relative(protoDir, fullPath),
          legacyFlat: false
        });
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".proto")) continue;
    const appId = basename(entry.name, ".proto");
    const fullPath = resolve(protoDir, entry.name);
    entries.push({
      appId,
      protoId: appId,
      fileName: entry.name,
      fullPath,
      relativePath: relative(protoDir, fullPath),
      legacyFlat: true
    });
  }

  return entries.sort((a, b) => {
    if (a.appId !== b.appId) return a.appId.localeCompare(b.appId);
    return a.protoId.localeCompare(b.protoId);
  });
}

function isHidden(name: string) {
  return name.startsWith(".");
}
