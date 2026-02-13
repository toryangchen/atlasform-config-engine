import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FormEntity } from "./form.schema";

@Injectable()
export class FormService {
  constructor(@InjectModel(FormEntity.name) private readonly formModel: Model<FormEntity>) {}

  create(tenantId: string, input: { appId: string; formName: string; version: string; schema: Record<string, unknown> }) {
    return this.formModel.create({
      tenantId,
      appId: input.appId,
      formName: input.formName,
      version: input.version,
      status: "draft",
      schema: input.schema
    });
  }

  async getLatestPublished(tenantId: string, formName: string) {
    const hit = await this.formModel
      .findOne({ tenantId, formName, status: "published" })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (!hit) throw new NotFoundException("Published form not found");
    return hit;
  }

  async getByVersion(tenantId: string, formName: string, version: string) {
    const hit = await this.formModel.findOne({ tenantId, formName, version }).lean();
    if (!hit) throw new NotFoundException("Form version not found");
    return hit;
  }

  async getByVersionInApp(tenantId: string, appId: string, formName: string, version: string) {
    const hit = await this.formModel.findOne({ tenantId, appId, formName, version }).lean();
    if (!hit) throw new NotFoundException("Form version not found in app");
    return hit;
  }

  async publish(tenantId: string, formName: string, version: string) {
    const form = await this.formModel
      .findOneAndUpdate({ tenantId, formName, version }, { $set: { status: "published" } }, { new: true })
      .lean();
    if (!form) throw new NotFoundException("Form version not found");
    return form;
  }

  listByApp(tenantId: string, appId: string) {
    return this.formModel.find({ tenantId, appId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
  }
}
