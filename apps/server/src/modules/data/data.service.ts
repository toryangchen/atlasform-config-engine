import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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

interface FormFieldMeta {
  name?: string;
  key?: string;
  label?: string;
  unique_key?: boolean;
  uniqueKey?: boolean;
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
    const uniqueField = this.getUniqueFieldName(form.schema as Record<string, unknown>);
    if (uniqueField) {
      const uniqueValue = this.readUniqueValue(input.data, uniqueField);
      if (uniqueValue === undefined || uniqueValue === "") {
        throw new BadRequestException(`Unique key "${uniqueField}" is required`);
      }
      await this.ensureUniqueValue(tenantId, appId, uniqueField, uniqueValue);
    }
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
    const nextData = input.data ?? current.data;
    if (input.data) patch.data = input.data;

    const targetFormName = input.formName ?? current.formName;
    const targetForm = await this.formService.getCurrentInApp(tenantId, appId, targetFormName);
    const uniqueField = this.getUniqueFieldName(targetForm.schema as Record<string, unknown>);
    if (uniqueField) {
      const oldValue = this.readUniqueValue(current.data ?? {}, uniqueField);
      const newValue = this.readUniqueValue(nextData ?? {}, uniqueField);

      if (newValue === undefined || newValue === "") {
        throw new BadRequestException(`Unique key "${uniqueField}" is required`);
      }
      if (oldValue !== undefined && oldValue !== "" && oldValue !== newValue) {
        throw new BadRequestException(`Unique key "${uniqueField}" is immutable once initialized`);
      }
      await this.ensureUniqueValue(tenantId, appId, uniqueField, newValue, objectId);
    }

    if (input.formName) {
      patch.formName = targetForm.formName;
      patch.version = targetForm.version;
    } else if (input.data) {
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

  async getByUniqueKey(tenantId: string, appId: string, uniqueValue: string, formName?: string) {
    const form = await this.formService.getCurrentInApp(tenantId, appId, formName);
    const uniqueField = this.getUniqueFieldName(form.schema as Record<string, unknown>);
    if (!uniqueField) throw new BadRequestException(`App "${appId}" does not define a unique key field`);
    const hit = (await this.collection(appId).findOne({
      tenantId,
      ...(formName ? { formName } : {}),
      [`data.${uniqueField}`]: uniqueValue
    })) as AppDataDocument | null;
    if (!hit) throw new NotFoundException("Data not found");
    return this.toResponse(appId, hit);
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

  private getUniqueFieldName(schema: Record<string, unknown>): string | null {
    const fieldsRaw = Array.isArray(schema.fields)
      ? schema.fields
      : schema.schema && typeof schema.schema === "object" && Array.isArray((schema.schema as Record<string, unknown>).fields)
        ? ((schema.schema as Record<string, unknown>).fields as unknown[])
        : [];
    const fields = fieldsRaw.filter((item): item is FormFieldMeta => Boolean(item) && typeof item === "object");
    const unique = fields.find((f) => Boolean(f.unique_key) || Boolean(f.uniqueKey));
    if (!unique) return null;
    if (typeof unique.name === "string" && unique.name) return unique.name;
    if (typeof unique.key === "string" && unique.key) return unique.key;
    return null;
  }

  private readUniqueValue(data: Record<string, unknown>, field: string): string | undefined {
    const value = data[field];
    if (value === null || value === undefined) return undefined;
    return String(value);
  }

  private async ensureUniqueValue(
    tenantId: string,
    appId: string,
    field: string,
    value: string,
    excludeId?: Types.ObjectId
  ) {
    const query: Record<string, unknown> = {
      tenantId,
      [`data.${field}`]: value
    };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await this.collection(appId).findOne(query);
    if (exists) throw new ConflictException(`Unique key "${field}" value "${value}" already exists`);
  }
}
