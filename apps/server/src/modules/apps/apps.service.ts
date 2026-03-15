import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { DataService } from "../data/data.service";
import { FormService } from "../form/form.service";
import { listBusinessProtoFiles, resolveProtoDir } from "./proto-catalog";
import { ProtoFormSyncService } from "./proto-form-sync.service";

export interface ProtoDefinition {
  appId: string;
  protoId: string;
  name: string;
  description: string;
  protoFile: string;
}

export interface AppDefinition {
  appId: string;
  name: string;
  description: string;
  protos: ProtoDefinition[];
}

@Injectable()
export class AppsService {
  constructor(
    private readonly formService: FormService,
    private readonly dataService: DataService,
    private readonly protoFormSyncService: ProtoFormSyncService
  ) {}

  listApps(): AppDefinition[] {
    const protoDir = resolveProtoDir();
    if (!protoDir) return [];

    const appMap = new Map<string, AppDefinition>();

    for (const entry of listBusinessProtoFiles(protoDir)) {
      const content = readFileSync(entry.fullPath, "utf-8");
      const meta = this.extractAppMeta(content);
      const protoMeta = this.extractProtoMeta(content);
      const app = appMap.get(entry.appId) ?? {
        appId: entry.appId,
        name: meta.name || this.toName(entry.appId),
        description: meta.description || `${this.toName(entry.appId)} application`,
        protos: []
      };

      app.protos.push({
        appId: entry.appId,
        protoId: entry.protoId,
        name: protoMeta.name || this.toName(entry.protoId),
        description: protoMeta.description || `${this.toName(entry.protoId)} proto`,
        protoFile: entry.relativePath
      });

      appMap.set(entry.appId, app);
    }

    return Array.from(appMap.values()).map((app) => ({
      ...app,
      protos: app.protos.sort((a, b) => a.protoId.localeCompare(b.protoId))
    }));
  }

  async listFormsByProto(tenantId: string, appId: string, protoId: string) {
    await this.protoFormSyncService.sync(tenantId);
    return this.formService.listByAppProto(tenantId, appId, protoId);
  }

  listDataByProto(tenantId: string, appId: string, protoId: string, scope: "active" | "deleted" | "all" = "active") {
    return this.dataService.listByAppProto(tenantId, appId, protoId, scope);
  }

  createDataInProto(
    tenantId: string,
    appId: string,
    protoId: string,
    input: { formName?: string; data: Record<string, unknown> }
  ) {
    return this.dataService.createInAppProto(tenantId, appId, protoId, input);
  }

  updateDataInProto(
    tenantId: string,
    appId: string,
    protoId: string,
    dataId: string,
    input: { formName?: string; data?: Record<string, unknown> }
  ) {
    return this.dataService.updateById(tenantId, appId, protoId, dataId, input);
  }

  removeDataInProto(tenantId: string, appId: string, protoId: string, dataId: string) {
    return this.dataService.removeById(tenantId, appId, protoId, dataId);
  }

  getDataByUniqueKey(tenantId: string, appId: string, protoId: string, uniqueValue: string, formName?: string) {
    return this.dataService.getByUniqueKey(tenantId, appId, protoId, uniqueValue, formName);
  }

  publishDataToPrd(tenantId: string, appId: string, protoId: string, dataId: string) {
    return this.dataService.publishToPrd(tenantId, appId, protoId, dataId);
  }

  private toName(appId: string): string {
    return appId
      .split(/[-_]/g)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  private extractAppMeta(content: string): { name?: string | undefined; description?: string | undefined } {
    const name = this.extractStringOption(content, ["app_name"]);
    const description = this.extractStringOption(content, ["app_description"]);
    return { name, description };
  }

  private extractProtoMeta(content: string): { name?: string | undefined; description?: string | undefined } {
    const name = this.extractStringOption(content, ["proto_name", "scope_name"]);
    const description = this.extractStringOption(content, ["proto_description", "scope_description"]);
    return { name, description };
  }

  private extractStringOption(content: string, keys: string[]): string | undefined {
    for (const key of keys) {
      const match = content.match(new RegExp(`option\\s*\\((?:[\\w.]+\\.)?${key}\\)\\s*=\\s*\"((?:\\\\.|[^\"])*)\"\\s*;`, "i"));
      if (!match?.[1]) continue;
      return match[1]
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    }
    return undefined;
  }
}
