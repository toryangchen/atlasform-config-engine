import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FormService } from "../form/form.service";
import { FormDataEntity } from "./data.schema";

@Injectable()
export class DataService {
  constructor(
    private readonly formService: FormService,
    @InjectModel(FormDataEntity.name) private readonly dataModel: Model<FormDataEntity>
  ) {}

  async create(tenantId: string, formName: string, version: string, data: Record<string, unknown>) {
    const form = await this.formService.getByVersion(tenantId, formName, version);
    return this.dataModel.create({
      tenantId,
      appId: form.appId,
      formName,
      version,
      data
    });
  }

  listByForm(tenantId: string, formName: string) {
    return this.dataModel.find({ tenantId, formName }).sort({ createdAt: -1 }).lean();
  }

  listByApp(tenantId: string, appId: string) {
    return this.dataModel.find({ tenantId, appId }).sort({ createdAt: -1 }).lean();
  }

  async createInApp(
    tenantId: string,
    appId: string,
    input: { formName: string; version: string; data: Record<string, unknown> }
  ) {
    await this.formService.getByVersionInApp(tenantId, appId, input.formName, input.version);
    return this.dataModel.create({
      tenantId,
      appId,
      formName: input.formName,
      version: input.version,
      data: input.data
    });
  }

  async updateById(
    tenantId: string,
    appId: string,
    dataId: string,
    input: { data?: Record<string, unknown>; formName?: string; version?: string }
  ) {
    const patch: Record<string, unknown> = {};
    if (input.data) patch.data = input.data;

    if (input.formName || input.version) {
      const current = await this.dataModel.findOne({ _id: dataId, tenantId, appId }).lean();
      if (!current) throw new NotFoundException("Data not found");
      const nextFormName = input.formName ?? current.formName;
      const nextVersion = input.version ?? current.version;
      await this.formService.getByVersionInApp(tenantId, appId, nextFormName, nextVersion);
      patch.formName = nextFormName;
      patch.version = nextVersion;
    }

    const updated = await this.dataModel.findOneAndUpdate({ _id: dataId, tenantId, appId }, { $set: patch }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Data not found");
    return updated;
  }

  async removeById(tenantId: string, appId: string, dataId: string) {
    const deleted = await this.dataModel.findOneAndDelete({ _id: dataId, tenantId, appId }).lean();
    if (!deleted) throw new NotFoundException("Data not found");
    return { deletedId: dataId };
  }
}
