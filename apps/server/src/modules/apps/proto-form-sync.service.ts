import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Connection } from "mongoose";
import { FormService } from "../form/form.service";

interface ProtoField {
  name: string;
  type: string;
  repeated: boolean;
}

interface MessageDef {
  name: string;
  fields: ProtoField[];
}

interface EnumDef {
  name: string;
  values: string[];
}

type SchemaField = Record<string, unknown>;

@Injectable()
export class ProtoFormSyncService implements OnModuleInit {
  private readonly logger = new Logger(ProtoFormSyncService.name);

  constructor(
    private readonly formService: FormService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async onModuleInit() {
    await this.sync("demo-tenant");
  }

  async sync(tenantId: string) {
    const protoDir = this.resolveProtoDir();
    if (!protoDir || !existsSync(protoDir)) return;

    const files = readdirSync(protoDir).filter((file) => file.endsWith(".proto"));
    const syncedByApp = new Map<string, string[]>();

    for (const file of files) {
      const appId = file.replace(/\.proto$/i, "");
      const fullPath = resolve(protoDir, file);
      const content = readFileSync(fullPath, "utf-8");

      try {
        const schema = this.buildSchemaFromProto(appId, content);
        if (!schema) continue;
        await this.ensureAppCollection(appId);
        await this.formService.create(tenantId, {
          appId,
          formName: schema.formName,
          version: schema.version,
          schema
        });
        const names = syncedByApp.get(appId) ?? [];
        names.push(schema.formName);
        syncedByApp.set(appId, names);
        this.logger.log(`Synced proto message: ${appId}/${schema.formName}@${schema.version}`);
      } catch (e) {
        this.logger.error(`Failed to sync ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const [appId, formNames] of syncedByApp) {
      await this.formService.keepOnlyByApp(tenantId, appId, formNames);
    }
  }

  private buildSchemaFromProto(appId: string, protoText: string): { appId: string; formName: string; version: string; fields: SchemaField[] } | null {
    const clean = this.stripComments(protoText);
    const messages = this.parseMessages(clean);
    const enums = this.parseEnums(clean);
    if (messages.size === 0) return null;

    const rootName = this.pickRootMessage(appId, messages);
    if (!rootName) return null;
    const root = messages.get(rootName)!;
    const fields = root.fields
      .map((field) => this.toSchemaField(field, messages, enums))
      .filter((item): item is SchemaField => Boolean(item));
    return {
      appId,
      formName: root.name,
      version: "1.0.0",
      fields
    };
  }

  private toSchemaField(field: ProtoField, messages: Map<string, MessageDef>, enums: Map<string, EnumDef>): SchemaField | null {
    const scalar = this.scalarKind(field.type);

    if (field.repeated) {
      if (scalar === "string") {
        return { name: field.name, label: this.toLabel(field.name), type: "array", item_type: "string", required: false, rules: [] };
      }
      if (scalar === "number") {
        return { name: field.name, label: this.toLabel(field.name), type: "array", item_type: "number", required: false, rules: [] };
      }
      if (scalar === "boolean") {
        return {
          name: field.name,
          label: this.toLabel(field.name),
          type: "checkbox-group",
          options: ["true", "false"],
          required: false,
          rules: []
        };
      }
      const enumDef = enums.get(field.type);
      if (enumDef) {
        return { name: field.name, label: this.toLabel(field.name), type: "checkbox-group", options: enumDef.values, required: false, rules: [] };
      }
      const obj = messages.get(field.type);
      if (obj) {
        return {
          name: field.name,
          label: this.toLabel(field.name),
          type: "array<object>",
          required: false,
          item_object_fields: obj.fields
            .map((f) => this.toSchemaField(f, messages, enums))
            .filter((item): item is SchemaField => Boolean(item)),
          rules: []
        };
      }
      return null;
    }

    if (scalar === "string") return { name: field.name, label: this.toLabel(field.name), type: "string", required: false, rules: [] };
    if (scalar === "number") return { name: field.name, label: this.toLabel(field.name), type: "number", required: false, rules: [] };
    if (scalar === "boolean") return { name: field.name, label: this.toLabel(field.name), type: "switch", required: false, rules: [] };

    const enumDef = enums.get(field.type);
    if (enumDef) {
      return { name: field.name, label: this.toLabel(field.name), type: "select", options: enumDef.values, required: false, rules: [] };
    }

    const obj = messages.get(field.type);
    if (obj) {
      return {
        name: field.name,
        label: this.toLabel(field.name),
        type: "object",
        required: false,
        object_fields: obj.fields
          .map((f) => this.toSchemaField(f, messages, enums))
          .filter((item): item is SchemaField => Boolean(item)),
        rules: []
      };
    }

    return null;
  }

  private parseMessages(text: string): Map<string, MessageDef> {
    const out = new Map<string, MessageDef>();
    const blocks = this.extractBlocks(text, "message");
    for (const b of blocks) {
      const body = this.removeInnerBlocks(b.body);
      const fields: ProtoField[] = [];
      for (const raw of body.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("reserved ") || line.startsWith("oneof ")) continue;
        const m = line.match(/^(repeated\s+)?([A-Za-z_][\w.]*)\s+([A-Za-z_]\w*)\s*=\s*\d+\s*(?:\[[^\]]*\])?;/);
        if (!m) continue;
        fields.push({
          repeated: Boolean(m[1]),
          type: m[2]!.split(".").pop()!,
          name: m[3]!
        });
      }
      out.set(b.name, { name: b.name, fields });
    }
    return out;
  }

  private parseEnums(text: string): Map<string, EnumDef> {
    const out = new Map<string, EnumDef>();
    const blocks = this.extractBlocks(text, "enum");
    for (const b of blocks) {
      const values = b.body
        .split("\n")
        .map((line) => line.trim())
        .map((line) => line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*\d+;/)?.[1] ?? null)
        .filter((v): v is string => Boolean(v));
      out.set(b.name, { name: b.name, values });
    }
    return out;
  }

  private extractBlocks(text: string, kind: "message" | "enum"): Array<{ name: string; body: string }> {
    const result: Array<{ name: string; body: string }> = [];
    const regex = new RegExp(`\\b${kind}\\s+([A-Za-z_]\\w*)\\s*\\{`, "g");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text))) {
      const name = m[1]!;
      const startBrace = regex.lastIndex - 1;
      const endBrace = this.findMatchingBrace(text, startBrace);
      if (endBrace < 0) continue;
      const body = text.slice(startBrace + 1, endBrace);
      result.push({ name, body });
      regex.lastIndex = endBrace + 1;
    }
    return result;
  }

  private findMatchingBrace(text: string, openPos: number): number {
    let depth = 0;
    for (let i = openPos; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  private removeInnerBlocks(body: string): string {
    let out = "";
    let depth = 0;
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i]!;
      if (ch === "{") {
        depth += 1;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        continue;
      }
      if (depth === 0) out += ch;
    }
    return out;
  }

  private pickRootMessage(appId: string, messages: Map<string, MessageDef>): string | null {
    const expect = this.toPascal(appId) + "Form";
    if (messages.has(expect)) return expect;
    if (messages.has("FormSchema")) return "FormSchema";
    const blacklist = new Set(["ValidationRule", "Field", "ProfileFormPreset"]);
    const fallback = [...messages.keys()].find((name) => !blacklist.has(name));
    return fallback ?? null;
  }

  private toPascal(input: string): string {
    return input
      .split(/[_-]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private scalarKind(type: string): "string" | "number" | "boolean" | null {
    if (type === "string" || type === "bytes") return "string";
    if (type === "bool") return "boolean";
    if (
      [
        "double",
        "float",
        "int32",
        "int64",
        "uint32",
        "uint64",
        "sint32",
        "sint64",
        "fixed32",
        "fixed64",
        "sfixed32",
        "sfixed64"
      ].includes(type)
    ) {
      return "number";
    }
    return null;
  }

  private toLabel(name: string): string {
    const text = name.replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private stripComments(input: string): string {
    return input
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  private async ensureAppCollection(appId: string) {
    const db = this.connection.db;
    if (!db) throw new Error("Mongo connection is not ready");
    const exists = await db.listCollections({ name: appId }).hasNext();
    if (!exists) await db.createCollection(appId);
    await db.collection(appId).createIndex({ tenantId: 1, updatedAt: -1 });
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
}
