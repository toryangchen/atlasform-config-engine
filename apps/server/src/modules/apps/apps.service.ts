import { Injectable } from "@nestjs/common";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DataService } from "../data/data.service";
import { FormService } from "../form/form.service";
import { ProtoFormSyncService } from "./proto-form-sync.service";

export interface AppDefinition {
  appId: string;
  name: string;
  protoFile: string;
}

@Injectable()
export class AppsService {
  constructor(
    private readonly formService: FormService,
    private readonly dataService: DataService,
    private readonly protoFormSyncService: ProtoFormSyncService
  ) {}

  listApps(): AppDefinition[] {
    const protoDir = this.resolveProtoDir();
    if (!protoDir || !existsSync(protoDir)) return [];

    return readdirSync(protoDir)
      .filter((file) => file.endsWith(".proto"))
      .map((file) => {
        const appId = file.replace(/\.proto$/i, "");
        return { appId, name: this.toName(appId), protoFile: file };
      });
  }

  async listFormsByApp(tenantId: string, appId: string) {
    await this.protoFormSyncService.sync(tenantId);
    return this.formService.listByApp(tenantId, appId);
  }

  listDataByApp(tenantId: string, appId: string, scope: "active" | "deleted" | "all" = "active") {
    return this.dataService.listByApp(tenantId, appId, scope);
  }

  createDataInApp(tenantId: string, appId: string, input: { formName?: string; data: Record<string, unknown> }) {
    return this.dataService.createInApp(tenantId, appId, input);
  }

  updateDataInApp(
    tenantId: string,
    appId: string,
    dataId: string,
    input: { formName?: string; data?: Record<string, unknown> }
  ) {
    return this.dataService.updateById(tenantId, appId, dataId, input);
  }

  removeDataInApp(tenantId: string, appId: string, dataId: string) {
    return this.dataService.removeById(tenantId, appId, dataId);
  }

  getDataByUniqueKey(tenantId: string, appId: string, uniqueValue: string, formName?: string) {
    return this.dataService.getByUniqueKey(tenantId, appId, uniqueValue, formName);
  }

  publishDataToPrd(tenantId: string, appId: string, dataId: string) {
    return this.dataService.publishToPrd(tenantId, appId, dataId);
  }

  private resolveProtoDir(): string | null {
    const candidates = [
      resolve(process.cwd(), "../../packages/proto-core/proto"),
      resolve(process.cwd(), "../packages/proto-core/proto"),
      resolve(process.cwd(), "packages/proto-core/proto")
    ];

    const hit = candidates.find((dir) => existsSync(dir));
    return hit ?? null;
  }

  private toName(appId: string): string {
    return appId
      .split(/[-_]/g)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

}
