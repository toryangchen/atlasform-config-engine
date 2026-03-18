import { existsSync, readdirSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

export interface ProtoCatalogEntry {
  appId: string;
  protoId: string;
  fileName: string;
  fullPath: string;
  relativePath: string;
}

export interface ProtoAppEntry {
  appId: string;
  dirPath: string;
  indexPath: string | null;
  relativeIndexPath: string | null;
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

export function listProtoApps(protoDir: string): ProtoAppEntry[] {
  const entries = readdirSync(protoDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !isHidden(entry.name) && !entry.name.startsWith("_"))
    .map((entry) => {
      const dirPath = resolve(protoDir, entry.name);
      const indexPath = resolve(dirPath, "index.proto");
      return {
        appId: entry.name,
        dirPath,
        indexPath: existsSync(indexPath) ? indexPath : null,
        relativeIndexPath: existsSync(indexPath) ? relative(protoDir, indexPath) : null
      };
    })
    .sort((a, b) => a.appId.localeCompare(b.appId));
}

export function listBusinessProtoFiles(protoDir: string): ProtoCatalogEntry[] {
  const files: ProtoCatalogEntry[] = [];

  for (const app of listProtoApps(protoDir)) {
    const childEntries = readdirSync(app.dirPath, { withFileTypes: true });
    for (const child of childEntries) {
      if (!child.isFile() || !child.name.endsWith(".proto") || isHidden(child.name) || child.name === "index.proto") continue;
      const fullPath = resolve(app.dirPath, child.name);
      files.push({
        appId: app.appId,
        protoId: basename(child.name, ".proto"),
        fileName: child.name,
        fullPath,
        relativePath: relative(protoDir, fullPath)
      });
    }
  }

  return files.sort((a, b) => (a.appId === b.appId ? a.protoId.localeCompare(b.protoId) : a.appId.localeCompare(b.appId)));
}

function isHidden(name: string) {
  return name.startsWith(".");
}
