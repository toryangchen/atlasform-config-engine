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
  label?: string;
  required?: boolean;
  pattern?: string;
  listVisible?: boolean;
  uniqueKey?: boolean;
}

interface MessageDef {
  name: string;
  fields: ProtoField[];
}

interface EnumDef {
  name: string;
  values: Array<string | { label: string; value: string }>;
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
    const clean = this.stripBlockComments(protoText);
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
    const label = field.label ?? this.toLabel(field.name);
    const required = Boolean(field.required);
    const rules = this.buildRules(field);
    const listVisible = Boolean(field.listVisible);
    const uniqueKey = Boolean(field.uniqueKey);

    if (field.repeated) {
      if (scalar === "string") {
        return { name: field.name, label, type: "array", item_type: "string", required, rules, list_visible: listVisible, unique_key: uniqueKey };
      }
      if (scalar === "number") {
        return { name: field.name, label, type: "array", item_type: "number", required, rules, list_visible: listVisible, unique_key: uniqueKey };
      }
      if (scalar === "boolean") {
        return {
          name: field.name,
          label,
          type: "checkbox-group",
          options: ["true", "false"],
          required,
          rules,
          list_visible: listVisible,
          unique_key: uniqueKey
        };
      }
      const enumDef = enums.get(field.type);
      if (enumDef) {
        return { name: field.name, label, type: "checkbox-group", options: enumDef.values, required, rules, list_visible: listVisible, unique_key: uniqueKey };
      }
      const obj = messages.get(field.type);
      if (obj) {
        return {
          name: field.name,
          label,
          type: "array<object>",
          required,
          item_object_fields: obj.fields
            .map((f) => this.toSchemaField(f, messages, enums))
            .filter((item): item is SchemaField => Boolean(item)),
          rules,
          list_visible: listVisible,
          unique_key: uniqueKey
        };
      }
      return null;
    }

    if (scalar === "string") return { name: field.name, label, type: "string", required, rules, list_visible: listVisible, unique_key: uniqueKey };
    if (scalar === "number") return { name: field.name, label, type: "number", required, rules, list_visible: listVisible, unique_key: uniqueKey };
    if (scalar === "boolean") return { name: field.name, label, type: "switch", required, rules, list_visible: listVisible, unique_key: uniqueKey };

    const enumDef = enums.get(field.type);
    if (enumDef) {
      return { name: field.name, label, type: "select", options: enumDef.values, required, rules, list_visible: listVisible, unique_key: uniqueKey };
    }

    const obj = messages.get(field.type);
    if (obj) {
      return {
        name: field.name,
        label,
        type: "object",
        required,
        object_fields: obj.fields
          .map((f) => this.toSchemaField(f, messages, enums))
          .filter((item): item is SchemaField => Boolean(item)),
        rules,
        list_visible: listVisible,
        unique_key: uniqueKey
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
      let pendingMeta: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean } = {};
      let statement = "";
      let statementMeta: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean } = {};

      for (const raw of body.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("//") && !statement) {
          const fromCommentLine = this.extractFieldMetaFromComment(line.replace(/^\/\//, "").trim());
          pendingMeta = {
            ...pendingMeta,
            ...fromCommentLine
          };
          continue;
        }

        const inlineCommentIndex = line.indexOf("//");
        const codePart = inlineCommentIndex >= 0 ? line.slice(0, inlineCommentIndex).trim() : line;
        const inlineComment = inlineCommentIndex >= 0 ? line.slice(inlineCommentIndex + 2).trim() : "";
        const inlineMeta = this.extractFieldMetaFromComment(inlineComment);
        statementMeta = { ...statementMeta, ...inlineMeta };
        if (!codePart) continue;

        statement = statement ? `${statement} ${codePart}` : codePart;
        if (!statement.includes(";")) continue;
        if (statement.startsWith("reserved ") || statement.startsWith("oneof ")) {
          statement = "";
          statementMeta = {};
          pendingMeta = {};
          continue;
        }

        const m = statement.match(/^(repeated\s+)?([A-Za-z_][\w.]*)\s+([A-Za-z_]\w*)\s*=\s*\d+\s*(?:\[.*\])?;/);
        if (!m) {
          statement = "";
          statementMeta = {};
          pendingMeta = {};
          continue;
        }
        const optionMeta = this.extractFieldMetaFromOptions(this.extractOptionsSegment(statement));
        const mergedMeta = { ...pendingMeta, ...statementMeta, ...optionMeta };
        const nextField: ProtoField = {
          repeated: Boolean(m[1]),
          type: m[2]!.split(".").pop()!,
          name: m[3]!
        };
        if (mergedMeta.label) nextField.label = mergedMeta.label;
        if (typeof mergedMeta.required === "boolean") nextField.required = mergedMeta.required;
        if (typeof mergedMeta.pattern === "string") nextField.pattern = mergedMeta.pattern;
        if (typeof mergedMeta.listVisible === "boolean") nextField.listVisible = mergedMeta.listVisible;
        if (typeof mergedMeta.uniqueKey === "boolean") nextField.uniqueKey = mergedMeta.uniqueKey;
        fields.push(nextField);
        pendingMeta = {};
        statement = "";
        statementMeta = {};
      }
      out.set(b.name, { name: b.name, fields });
    }
    return out;
  }

  private parseEnums(text: string): Map<string, EnumDef> {
    const out = new Map<string, EnumDef>();
    const blocks = this.extractBlocks(text, "enum");
    for (const b of blocks) {
      const values: Array<string | { label: string; value: string }> = [];
      let statement = "";
      let statementComment = "";
      for (const raw of b.body.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("//")) continue;
        const inlineCommentIndex = line.indexOf("//");
        const codePart = inlineCommentIndex >= 0 ? line.slice(0, inlineCommentIndex).trim() : line;
        const inlineComment = inlineCommentIndex >= 0 ? line.slice(inlineCommentIndex + 2).trim() : "";
        if (!codePart) continue;

        statement = statement ? `${statement} ${codePart}` : codePart;
        statementComment = [statementComment, inlineComment].filter(Boolean).join(" ").trim();
        if (!statement.includes(";")) continue;

        const m = statement.match(/^([A-Z][A-Z0-9_]*)\s*=\s*\d+\s*(?:\[.*\])?\s*;/);
        if (!m?.[1]) {
          statement = "";
          statementComment = "";
          continue;
        }
        const enumKey = m[1];
        const optionMeta = this.extractEnumValueMetaFromOptions(this.extractOptionsSegment(statement));
        const commentMeta = this.extractEnumValueMetaFromComment(statementComment);
        const meta = { ...commentMeta, ...optionMeta };
        const label = meta.label ?? this.toEnumLabel(enumKey);
        const value = meta.value ?? enumKey;
        values.push({ label, value });
        statement = "";
        statementComment = "";
      }
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

  private extractOptionsSegment(statement: string): string {
    const semiIndex = statement.lastIndexOf(";");
    const end = semiIndex >= 0 ? semiIndex : statement.length;
    const open = statement.indexOf("[");
    if (open < 0) return "";
    const close = statement.lastIndexOf("]", end);
    if (close < 0 || close <= open) return "";
    return statement.slice(open + 1, close);
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
    let inLineComment = false;
    let inString = false;
    let quoteChar = "";
    let escaping = false;
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i]!;
      const next = i + 1 < body.length ? body[i + 1] : "";

      if (!inLineComment && ch === "/" && next === "/") {
        inLineComment = true;
        if (depth === 0) out += "//";
        i += 1;
        continue;
      }

      if (inLineComment) {
        if (depth === 0) out += ch;
        if (ch === "\n") inLineComment = false;
        continue;
      }

      if (inString) {
        if (depth === 0) out += ch;
        if (escaping) {
          escaping = false;
          continue;
        }
        if (ch === "\\") {
          escaping = true;
          continue;
        }
        if (ch === quoteChar) {
          inString = false;
          quoteChar = "";
        }
        continue;
      }

      if (ch === "\"" || ch === "'") {
        inString = true;
        quoteChar = ch;
        if (depth === 0) out += ch;
        continue;
      }

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

  private toEnumLabel(name: string): string {
    const normalized = name
      .replace(/_UNSPECIFIED$/i, "")
      .replace(/_/g, " ")
      .trim()
      .toLowerCase();
    if (!normalized) return name;
    return normalized
      .split(/\s+/g)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private extractFieldMetaFromComment(comment: string): { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean } {
    const result: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean } = {};
    if (!comment) return result;
    const labelMatch = comment.match(/@label\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
    if (labelMatch?.[1]) {
      const rawLabel = labelMatch[1].trim();
      if (rawLabel) {
        result.label = rawLabel.replace(/\s*\*+$/, "").trim();
        if (/\*+\s*$/.test(rawLabel)) result.required = true;
      }
    }

    const requiredMatch = comment.match(/@require(?:d)?(?:\s*[:=]?\s*(true|false|1|0|yes|no))?/i);
    if (requiredMatch) {
      const token = requiredMatch[1]?.toLowerCase();
      if (!token) {
        result.required = true;
      } else {
        result.required = token === "true" || token === "1" || token === "yes";
      }
    }

    const patternMatch = comment.match(/@(pattern|regex)\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
    if (patternMatch?.[2]) {
      const raw = patternMatch[2].trim();
      const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      const pattern = unquoted.replace(/\\\\/g, "\\");
      if (this.isValidRegex(pattern)) result.pattern = pattern;
    }

    const listMatch = comment.match(/@(list|table|list_visible)(?:\s*[:=]?\s*(true|false|1|0|yes|no))?/i);
    if (listMatch) {
      const token = listMatch[2]?.toLowerCase();
      if (!token) {
        result.listVisible = true;
      } else {
        result.listVisible = token === "true" || token === "1" || token === "yes";
      }
    }

    const uniqueMatch = comment.match(/@(unique|unique_key|uk)(?:\s*[:=]?\s*(true|false|1|0|yes|no))?/i);
    if (uniqueMatch) {
      const token = uniqueMatch[2]?.toLowerCase();
      if (!token) {
        result.uniqueKey = true;
      } else {
        result.uniqueKey = token === "true" || token === "1" || token === "yes";
      }
    }

    return result;
  }

  private extractFieldMetaFromOptions(options: string): { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean } {
    const result: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean } = {};
    if (!options) return result;

    const label = this.extractStringOption(options, ["ui_label"]);
    if (label) result.label = label;

    const required = this.extractBooleanOption(options, ["ui_required"]);
    if (typeof required === "boolean") result.required = required;

    const pattern = this.extractStringOption(options, ["ui_pattern"]);
    if (pattern) {
      const normalized = pattern.replace(/\\\\/g, "\\");
      if (this.isValidRegex(normalized)) result.pattern = normalized;
    }

    const listVisible = this.extractBooleanOption(options, ["ui_list"]);
    if (typeof listVisible === "boolean") result.listVisible = listVisible;

    const uniqueKey = this.extractBooleanOption(options, ["ui_unique"]);
    if (typeof uniqueKey === "boolean") result.uniqueKey = uniqueKey;

    return result;
  }

  private extractEnumValueMetaFromOptions(options: string): { label?: string; value?: string } {
    const result: { label?: string; value?: string } = {};
    if (!options) return result;
    const label = this.extractStringOption(options, ["ui_enum_label"]);
    if (label) result.label = label;
    const value = this.extractStringOption(options, ["ui_enum_value"]);
    if (value !== undefined) result.value = value;
    return result;
  }

  private extractStringOption(options: string, keys: string[]): string | undefined {
    for (const key of keys) {
      const match = options.match(new RegExp(`\\((?:[\\w.]+\\.)?${key}\\)\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "i"));
      if (match && typeof match[1] === "string") {
        const raw = match[1];
        return raw
          .replace(/\\"/g, "\"")
          .replace(/\\\\/g, "\\");
      }
    }
    return undefined;
  }

  private extractBooleanOption(options: string, keys: string[]): boolean | undefined {
    for (const key of keys) {
      const match = options.match(new RegExp(`\\((?:[\\w.]+\\.)?${key}\\)\\s*=\\s*(true|false)`, "i"));
      if (match?.[1]) return match[1].toLowerCase() === "true";
    }
    return undefined;
  }

  private buildRules(field: ProtoField): Array<{ type: string; value?: string }> {
    const rules: Array<{ type: string; value?: string }> = [];
    if (field.pattern) rules.push({ type: "pattern", value: field.pattern });
    return rules;
  }

  private isValidRegex(pattern: string): boolean {
    try {
      // Validate pattern at parse-time to avoid runtime crashes in UI.
      // eslint-disable-next-line no-new
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }

  private extractEnumValueMetaFromComment(comment: string): { label?: string; value?: string } {
    const result: { label?: string; value?: string } = {};
    if (!comment) return result;

    const labelMatch = comment.match(/@label\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
    if (labelMatch?.[1]) {
      const label = labelMatch[1].trim();
      if (label) result.label = label;
    }

    const valueMatch = comment.match(/@value\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
    if (valueMatch?.[1]) {
      const value = valueMatch[1].trim();
      if (value) {
        const unquoted = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        result.value = unquoted;
      }
    }

    return result;
  }

  private stripBlockComments(input: string): string {
    return input.replace(/\/\*[\s\S]*?\*\//g, "");
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
