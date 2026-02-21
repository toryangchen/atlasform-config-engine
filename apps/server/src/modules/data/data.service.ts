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
  prdFormName?: string;
  prdVersion?: string;
  prdData?: Record<string, unknown>;
  prdUpdatedAt?: Date;
  deletedAt?: Date;
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

  async listByApp(tenantId: string, appId: string, scope: "active" | "deleted" | "all" = "active") {
    const query: Record<string, unknown> = { tenantId };
    if (scope === "active") query.deletedAt = { $exists: false };
    if (scope === "deleted") query.deletedAt = { $exists: true };
    const rows = (await this.collection(appId)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()) as AppDataDocument[];
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
    const unsetPatch: Record<string, 1> = {};
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

    // Soft-deleted record can be revived by editing and saving it again.
    // When revived, we only keep DEV state and require explicit re-publish to PRD.
    if (current.deletedAt && input.data) {
      unsetPatch.deletedAt = 1;
      unsetPatch.prdFormName = 1;
      unsetPatch.prdVersion = 1;
      unsetPatch.prdData = 1;
      unsetPatch.prdUpdatedAt = 1;
    }

    if (input.formName) {
      patch.formName = targetForm.formName;
      patch.version = targetForm.version;
    } else if (input.data) {
      patch.formName = targetForm.formName;
      patch.version = targetForm.version;
    }

    patch.updatedAt = new Date();

    const updateDoc: Record<string, unknown> = { $set: patch };
    if (Object.keys(unsetPatch).length > 0) updateDoc.$unset = unsetPatch;
    await coll.updateOne({ _id: objectId, tenantId }, updateDoc);
    const updated = await coll.findOne({ _id: objectId, tenantId });
    if (!updated) throw new NotFoundException("Data not found");
    return this.toResponse(appId, updated as AppDataDocument);
  }

  async removeById(tenantId: string, appId: string, dataId: string) {
    const objectId = this.parseObjectId(dataId);
    const res = await this.collection(appId).updateOne(
      { _id: objectId, tenantId, deletedAt: { $exists: false } },
      {
        $set: { deletedAt: new Date(), updatedAt: new Date() }
      }
    );
    if (res.matchedCount < 1) throw new NotFoundException("Data not found");
    return { deletedId: dataId, softDeleted: true };
  }

  async publishToPrd(tenantId: string, appId: string, dataId: string) {
    const objectId = this.parseObjectId(dataId);
    const coll = this.collection(appId);
    const current = (await coll.findOne({ _id: objectId, tenantId, deletedAt: { $exists: false } })) as AppDataDocument | null;
    if (!current) throw new NotFoundException("Data not found");

    const now = new Date();
    await coll.updateOne(
      { _id: objectId, tenantId },
      {
        $set: {
          prdFormName: current.formName,
          prdVersion: current.version,
          prdData: current.data,
          prdUpdatedAt: now
        }
      }
    );

    const updated = (await coll.findOne({ _id: objectId, tenantId })) as AppDataDocument | null;
    if (!updated) throw new NotFoundException("Data not found");
    return this.toResponse(appId, updated);
  }

  async getByUniqueKey(tenantId: string, appId: string, uniqueValue: string, formName?: string) {
    const form = await this.formService.getCurrentInApp(tenantId, appId, formName);
    const uniqueField = this.getUniqueFieldName(form.schema as Record<string, unknown>);
    if (!uniqueField) throw new BadRequestException(`App "${appId}" does not define a unique key field`);
    const hit = (await this.collection(appId).findOne({
      tenantId,
      ...(formName ? { formName } : {}),
      deletedAt: { $exists: false },
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
      prdFormName: row.prdFormName,
      prdVersion: row.prdVersion,
      prdData: row.prdData,
      prdUpdatedAt: row.prdUpdatedAt,
      published: Boolean(row.prdData),
      deletedAt: row.deletedAt,
      deleted: Boolean(row.deletedAt),
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
      deletedAt: { $exists: false },
      [`data.${field}`]: value
    };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await this.collection(appId).findOne(query);
    if (exists) throw new ConflictException(`Unique key "${field}" value "${value}" already exists`);
  }
}
