import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, Types } from "mongoose";
import { FormService } from "../form/form.service";

interface AppDataDocument {
  _id?: Types.ObjectId;
  tenantId: string;
  appId: string;
  formName: string;
  version: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DataService {
  constructor(
    private readonly formService: FormService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async create(tenantId: string, formName: string, data: Record<string, unknown>) {
    const form = await this.formService.getLatestPublished(tenantId, formName);
    return this.createInApp(tenantId, form.appId, { formName, data });
  }

  async listByForm(tenantId: string, formName: string) {
    const form = await this.formService.getLatestPublished(tenantId, formName);
    return this.listByApp(tenantId, form.appId);
  }

  async listByApp(tenantId: string, appId: string) {
    const rows = (await this.collection(appId).find({ tenantId }).sort({ createdAt: -1 }).toArray()) as AppDataDocument[];
    return rows.map((row) => this.toResponse(appId, row));
  }

  async createInApp(
    tenantId: string,
    appId: string,
    input: { formName?: string; data: Record<string, unknown> }
  ) {
    const form = await this.formService.getCurrentInApp(tenantId, appId, input.formName);
    const now = new Date();
    const payload: AppDataDocument = {
      tenantId,
      appId,
      formName: form.formName,
      version: form.version,
      data: input.data,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.collection(appId).insertOne(payload);
    return this.toResponse(appId, { ...payload, _id: result.insertedId });
  }

  async updateById(
    tenantId: string,
    appId: string,
    dataId: string,
    input: { data?: Record<string, unknown>; formName?: string }
  ) {
    const objectId = this.parseObjectId(dataId);
    const coll = this.collection(appId);
    const current = await coll.findOne({ _id: objectId, tenantId });
    if (!current) throw new NotFoundException("Data not found");

    const patch: Record<string, unknown> = {};
    if (input.data) patch.data = input.data;

    if (input.formName) {
      const targetForm = await this.formService.getCurrentInApp(tenantId, appId, input.formName);
      patch.formName = targetForm.formName;
      patch.version = targetForm.version;
    } else if (input.data) {
      const targetForm = await this.formService.getCurrentInApp(tenantId, appId, current.formName);
      patch.formName = targetForm.formName;
      patch.version = targetForm.version;
    }

    patch.updatedAt = new Date();

    await coll.updateOne({ _id: objectId, tenantId }, { $set: patch });
    const updated = await coll.findOne({ _id: objectId, tenantId });
    if (!updated) throw new NotFoundException("Data not found");
    return this.toResponse(appId, updated as AppDataDocument);
  }

  async removeById(tenantId: string, appId: string, dataId: string) {
    const objectId = this.parseObjectId(dataId);
    const res = await this.collection(appId).deleteOne({ _id: objectId, tenantId });
    if (res.deletedCount < 1) throw new NotFoundException("Data not found");
    return { deletedId: dataId };
  }

  private collection(appId: string) {
    if (!this.connection.db) throw new Error("Mongo connection is not ready");
    return this.connection.db.collection(appId);
  }

  private parseObjectId(dataId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(dataId)) throw new NotFoundException("Data not found");
    return new Types.ObjectId(dataId);
  }

  private toResponse(appId: string, row: AppDataDocument) {
    return {
      _id: String(row._id),
      appId,
      formName: row.formName,
      version: row.version,
      data: row.data,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
