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
  type?: string;
  fieldType?: string;
  required?: boolean;
  rules?: Array<{ type?: string; value?: string }>;
  object_fields?: FormFieldMeta[];
  objectFields?: FormFieldMeta[];
  item_object_fields?: FormFieldMeta[];
  itemObjectFields?: FormFieldMeta[];
  fields?: FormFieldMeta[];
  unique_key?: boolean;
  uniqueKey?: boolean;
}

interface UniqueFieldMeta {
  name: string;
  label: string;
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
    this.validateDataBySchema(form.schema as Record<string, unknown>, input.data);
    const uniqueField = this.getUniqueFieldMeta(form.schema as Record<string, unknown>);
    if (uniqueField) {
      const uniqueValue = this.readUniqueValue(input.data, uniqueField.name);
      if (uniqueValue === undefined || uniqueValue === "") {
        throw new BadRequestException(`请填写唯一标识字段：${uniqueField.label}`);
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
    this.validateDataBySchema(targetForm.schema as Record<string, unknown>, nextData);
    const uniqueField = this.getUniqueFieldMeta(targetForm.schema as Record<string, unknown>);
    if (uniqueField) {
      const oldValue = this.readUniqueValue(current.data ?? {}, uniqueField.name);
      const newValue = this.readUniqueValue(nextData ?? {}, uniqueField.name);

      if (newValue === undefined || newValue === "") {
        throw new BadRequestException(`请填写唯一标识字段：${uniqueField.label}`);
      }
      if (oldValue !== undefined && oldValue !== "" && oldValue !== newValue) {
        throw new BadRequestException(`${uniqueField.label} 创建后不可修改`);
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
    const uniqueField = this.getUniqueFieldMeta(form.schema as Record<string, unknown>);
    if (!uniqueField) throw new BadRequestException(`App "${appId}" does not define a unique key field`);
    const hit = (await this.collection(appId).findOne({
      tenantId,
      ...(formName ? { formName } : {}),
      deletedAt: { $exists: false },
      [`data.${uniqueField.name}`]: uniqueValue
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

  private getUniqueFieldMeta(schema: Record<string, unknown>): UniqueFieldMeta | null {
    const fields = this.extractSchemaFields(schema);
    const unique = fields.find((f) => Boolean(f.unique_key) || Boolean(f.uniqueKey));
    if (!unique) return null;
    const name = typeof unique.name === "string" && unique.name ? unique.name : typeof unique.key === "string" ? unique.key : "";
    if (!name) return null;
    const label = typeof unique.label === "string" && unique.label ? unique.label : name;
    return { name, label };
  }

  private readUniqueValue(data: Record<string, unknown>, field: string): string | undefined {
    const value = data[field];
    if (value === null || value === undefined) return undefined;
    return String(value);
  }

  private async ensureUniqueValue(
    tenantId: string,
    appId: string,
    field: UniqueFieldMeta,
    value: string,
    excludeId?: Types.ObjectId
  ) {
    const query: Record<string, unknown> = {
      tenantId,
      deletedAt: { $exists: false },
      [`data.${field.name}`]: value
    };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await this.collection(appId).findOne(query);
    if (exists) throw new ConflictException(`${field.label}「${value}」已存在，请使用其他值`);
  }

  private extractSchemaFields(schema: Record<string, unknown>): FormFieldMeta[] {
    const fieldsRaw = Array.isArray(schema.fields)
      ? schema.fields
      : schema.schema && typeof schema.schema === "object" && Array.isArray((schema.schema as Record<string, unknown>).fields)
        ? ((schema.schema as Record<string, unknown>).fields as unknown[])
        : [];
    return fieldsRaw.filter((item): item is FormFieldMeta => Boolean(item) && typeof item === "object");
  }

  private validateDataBySchema(schema: Record<string, unknown>, data: Record<string, unknown>) {
    const fields = this.extractSchemaFields(schema);
    for (const field of fields) {
      const key = this.resolveFieldName(field);
      if (!key) continue;
      const label = typeof field.label === "string" && field.label ? field.label : key;
      const value = data[key];
      this.validateFieldValue(field, value, label);
    }
  }

  private resolveFieldName(field: FormFieldMeta): string {
    if (typeof field.name === "string" && field.name) return field.name;
    if (typeof field.key === "string" && field.key) return field.key;
    return "";
  }

  private resolveFieldType(field: FormFieldMeta): string {
    if (typeof field.type === "string" && field.type) return field.type;
    if (typeof field.fieldType === "string" && field.fieldType) return field.fieldType;
    return "string";
  }

  private validateFieldValue(field: FormFieldMeta, value: unknown, pathLabel: string) {
    if (value === undefined || value === null || value === "") return;
    const fieldType = this.resolveFieldType(field);
    const ruleTypes = Array.isArray(field.rules) ? field.rules.map((item) => item?.type).filter((item): item is string => Boolean(item)) : [];
    const shouldValidateJson = fieldType === "json" || ruleTypes.includes("json");
    const shouldValidateMarkdown = fieldType === "markdown" || ruleTypes.includes("markdown");

    if (shouldValidateJson) {
      if (typeof value !== "string") {
        throw new BadRequestException(`${pathLabel} 必须是 JSON 字符串`);
      }
      if (!this.isValidJsonString(value)) {
        throw new BadRequestException(`${pathLabel} JSON 格式不正确`);
      }
      return;
    }

    if (shouldValidateMarkdown) {
      if (typeof value !== "string") {
        throw new BadRequestException(`${pathLabel} 必须是 Markdown 字符串`);
      }
      if (!this.isValidMarkdownString(value)) {
        throw new BadRequestException(`${pathLabel} Markdown 格式不正确`);
      }
      return;
    }

    if (fieldType === "image") {
      if (typeof value === "string" && this.isValidImageUrl(value)) return;
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string" && this.isValidImageUrl(value[0])) return;
      throw new BadRequestException(`${pathLabel} 必须是有效图片 URL`);
    }

    if (fieldType === "array-image") {
      if (!Array.isArray(value)) {
        throw new BadRequestException(`${pathLabel} 必须是图片 URL 数组`);
      }
      value.forEach((item, index) => {
        if (typeof item !== "string" || !this.isValidImageUrl(item)) {
          throw new BadRequestException(`${pathLabel}[${index}] 必须是有效图片 URL`);
        }
      });
      return;
    }

    if (fieldType === "object") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new BadRequestException(`${pathLabel} 必须是对象`);
      }
      const childFields = this.extractChildFields(field, "object");
      for (const child of childFields) {
        const childName = this.resolveFieldName(child);
        if (!childName) continue;
        const childLabel = typeof child.label === "string" && child.label ? child.label : childName;
        this.validateFieldValue(child, (value as Record<string, unknown>)[childName], `${pathLabel}.${childLabel}`);
      }
      return;
    }

    if (fieldType === "array<object>") {
      const childFields = this.extractChildFields(field, "array<object>");
      if (!Array.isArray(value)) {
        // Backward-compat for old data: object can be treated as first row.
        if (value && typeof value === "object") {
          for (const child of childFields) {
            const childName = this.resolveFieldName(child);
            if (!childName) continue;
            const childLabel = typeof child.label === "string" && child.label ? child.label : childName;
            this.validateFieldValue(child, (value as Record<string, unknown>)[childName], `${pathLabel}[0].${childLabel}`);
          }
          return;
        }
        throw new BadRequestException(`${pathLabel} 必须是对象数组`);
      }

      value.forEach((row, index) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          throw new BadRequestException(`${pathLabel}[${index}] 必须是对象`);
        }
        for (const child of childFields) {
          const childName = this.resolveFieldName(child);
          if (!childName) continue;
          const childLabel = typeof child.label === "string" && child.label ? child.label : childName;
          this.validateFieldValue(child, (row as Record<string, unknown>)[childName], `${pathLabel}[${index}].${childLabel}`);
        }
      });
    }
  }

  private extractChildFields(field: FormFieldMeta, type: "object" | "array<object>"): FormFieldMeta[] {
    const source =
      type === "object"
        ? field.object_fields ?? field.objectFields ?? field.fields ?? []
        : field.item_object_fields ?? field.itemObjectFields ?? [];
    if (!Array.isArray(source)) return [];
    return source.filter((item): item is FormFieldMeta => Boolean(item) && typeof item === "object");
  }

  private isValidJsonString(input: string): boolean {
    try {
      JSON.parse(input);
      return true;
    } catch {
      return false;
    }
  }

  private isValidMarkdownString(input: string): boolean {
    if (input.includes("\u0000")) return false;
    let fence: "`" | "~" | null = null;
    for (const line of input.split(/\r?\n/g)) {
      const trimmed = line.trimStart();
      const matched = trimmed.match(/^(```+|~~~+)/);
      if (!matched?.[1]) continue;
      const token = matched[1].charAt(0) as "`" | "~";
      if (!fence) {
        fence = token;
        continue;
      }
      if (fence === token) fence = null;
    }
    return fence === null;
  }

  private isValidImageUrl(input: string): boolean {
    const url = input.trim();
    if (!url) return false;
    if (url.startsWith("data:image/")) return true;
    if (url.startsWith("blob:")) return true;
    if (url.startsWith("/")) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
}
