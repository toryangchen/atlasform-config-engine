import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FormEntity } from "./form.schema";

@Injectable()
export class FormService {
  constructor(@InjectModel(FormEntity.name) private readonly formModel: Model<FormEntity>) {}

  async create(tenantId: string, input: { appId: string; formName: string; version: string; schema: Record<string, unknown> }) {
    const query = { tenantId, appId: input.appId, formName: input.formName };
    const form = await this.formModel
      .findOneAndUpdate(
        query,
        {
          $set: {
            version: input.version,
            status: "published",
            schema: input.schema
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .lean();

    await this.formModel.deleteMany({ ...query, _id: { $ne: form!._id } });
    return form;
  }

  async getLatestPublished(tenantId: string, formName: string) {
    const hit = await this.formModel.findOne({ tenantId, formName }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    if (!hit) throw new NotFoundException("Published form not found");
    return hit;
  }

  async getByVersion(tenantId: string, formName: string, version: string) {
    const hit = await this.formModel.findOne({ tenantId, formName }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    if (!hit) throw new NotFoundException("Form not found");
    if (hit.version !== version) throw new NotFoundException(`Form version not found, current version is ${hit.version}`);
    return hit;
  }

  async getByVersionInApp(tenantId: string, appId: string, formName: string, version: string) {
    const hit = await this.formModel.findOne({ tenantId, appId, formName }).lean();
    if (!hit) throw new NotFoundException("Form not found in app");
    if (hit.version !== version) throw new NotFoundException(`Form version not found, current version is ${hit.version}`);
    return hit;
  }

  async getCurrentInApp(tenantId: string, appId: string, formName?: string) {
    const hit = await this.formModel
      .findOne({ tenantId, appId, ...(formName ? { formName } : {}) })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (!hit) throw new NotFoundException("Form not found in app");
    return hit;
  }

  async publish(tenantId: string, formName: string) {
    const form = await this.formModel
      .findOneAndUpdate({ tenantId, formName }, { $set: { status: "published" } }, { new: true, sort: { updatedAt: -1 } })
      .lean();
    if (!form) throw new NotFoundException("Form not found");
    return form;
  }

  async keepOnlyByApp(tenantId: string, appId: string, allowedFormNames: string[]) {
    return this.formModel.deleteMany({ tenantId, appId, formName: { $nin: allowedFormNames } });
  }

  async listByApp(tenantId: string, appId: string) {
    const rows = await this.formModel.find({ tenantId, appId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const seen = new Set<string>();
    const deduped = [];
    for (const row of rows) {
      if (seen.has(row.formName)) continue;
      seen.add(row.formName);
      deduped.push(row);
    }
    return deduped;
  }
}
