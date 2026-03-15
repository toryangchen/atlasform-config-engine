import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { readFileSync } from "node:fs";
import { Connection } from "mongoose";
import { FormService } from "../form/form.service";
import { listBusinessProtoFiles, resolveProtoDir } from "./proto-catalog";

interface ProtoField {
  name: string;
  type: string;
  repeated: boolean;
  label?: string;
  required?: boolean;
  pattern?: string;
  listVisible?: boolean;
  uniqueKey?: boolean;
  widget?: string;
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
    const protoDir = resolveProtoDir();
    if (!protoDir) return;

    const protoFiles = listBusinessProtoFiles(protoDir);
    const syncedByProto = new Map<string, string[]>();

    for (const entry of protoFiles) {
      const content = readFileSync(entry.fullPath, "utf-8");

      try {
        const schema = this.buildSchemaFromProto(entry.appId, entry.protoId, content);
        if (!schema) continue;
        await this.ensureAppCollection(entry.appId);
        await this.formService.create(tenantId, {
          appId: entry.appId,
          protoId: entry.protoId,
          formName: schema.formName,
          version: schema.version,
          schema
        });
        const syncKey = `${entry.appId}:${entry.protoId}`;
        const names = syncedByProto.get(syncKey) ?? [];
        names.push(schema.formName);
        syncedByProto.set(syncKey, names);
        this.logger.log(`Synced proto message: ${entry.appId}/${entry.protoId}/${schema.formName}@${schema.version}`);
      } catch (e) {
        this.logger.error(`Failed to sync ${entry.relativePath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const [syncKey, formNames] of syncedByProto) {
      const [appId, protoId] = syncKey.split(":");
      if (!appId || !protoId) continue;
      await this.formService.keepOnlyByAppProto(tenantId, appId, protoId, formNames);
    }
  }

  private buildSchemaFromProto(
    appId: string,
    protoId: string,
    protoText: string
  ): { appId: string; protoId: string; formName: string; version: string; fields: SchemaField[] } | null {
    const clean = this.stripBlockComments(protoText);
    const messages = this.parseMessages(clean);
    const enums = this.parseEnums(clean);
    if (messages.size === 0) return null;

    const rootName = this.pickRootMessage(appId, protoId, messages);
    if (!rootName) return null;
    const root = messages.get(rootName)!;
    const fields = root.fields
      .map((field) => this.toSchemaField(field, messages, enums))
      .filter((item): item is SchemaField => Boolean(item));
    return {
      appId,
      protoId,
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
        if (field.widget === "image") {
          return { name: field.name, label, type: "array-image", required, rules, list_visible: listVisible, unique_key: uniqueKey };
        }
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

    if (scalar === "string") {
      const widget = field.widget?.trim().toLowerCase();
      const type = widget === "textarea" || widget === "markdown" || widget === "json" || widget === "image" ? widget : "string";
      return { name: field.name, label, type, required, rules, list_visible: listVisible, unique_key: uniqueKey };
    }
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
      let pendingMeta: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean; widget?: string } = {};
      let statement = "";
      let statementMeta: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean; widget?: string } = {};

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
        if (typeof mergedMeta.widget === "string") nextField.widget = mergedMeta.widget;
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

  // Common message name suffixes that indicate root form messages
  private readonly ROOT_MESSAGE_SUFFIXES = ["Form", "FormSchema", "Schema", "Config", "Settings"];

  // Patterns that indicate non-root messages (typically helper/auxiliary types)
  private readonly HELPER_MESSAGE_PATTERNS = [
    /^Validation/,
    /^Field/,
    /^Meta$/,
    /^Options$/,
    /Preset$/,
    /^Query$/,
    /^Filter$/,
    /^Sort$/,
    /^Pagination$/,
    /^Common/,
    /^Helper/,
    /^Util/,
    /Enum$/,
    /Type$/,
  ];

  private pickRootMessage(appId: string, protoId: string, messages: Map<string, MessageDef>): string | null {
    const messageNames = Array.from(messages.keys());
    if (messageNames.length === 0) return null;

    // Priority 1: Exact match with expected name (protoId + "Form")
    const protoExpect = this.toPascal(protoId) + "Form";
    if (messages.has(protoExpect)) return protoExpect;

    // Priority 1.5: appId + "Form" for legacy flat proto files.
    const appExpect = this.toPascal(appId) + "Form";
    if (messages.has(appExpect)) return appExpect;

    // Priority 2: Common root message names
    if (messages.has("FormSchema")) return "FormSchema";

    // Priority 3: Messages with "Form" suffix
    const formMessages = messageNames.filter((name) => name.endsWith("Form"));
    if (formMessages.length === 1) {
      return formMessages[0] ?? null;
    }
    // If multiple Form messages, prefer the one matching appId
    if (formMessages.length > 1) {
      const matched = formMessages.find((name) => name.toLowerCase().includes(protoId.toLowerCase()))
        ?? formMessages.find((name) => name.toLowerCase().includes(appId.toLowerCase()));
      if (matched) return matched;
    }

    // Priority 4: Messages with other form-oriented suffixes
    for (const suffix of this.ROOT_MESSAGE_SUFFIXES.slice(2)) {
      const messagesWithSuffix = messageNames.filter((name) => name.endsWith(suffix));
      if (messagesWithSuffix.length === 1) {
        return messagesWithSuffix[0] ?? null;
      }
      // If multiple, prefer the one matching appId
      if (messagesWithSuffix.length > 1) {
        const matched = messagesWithSuffix.find((name) => name.toLowerCase().includes(protoId.toLowerCase()))
          ?? messagesWithSuffix.find((name) => name.toLowerCase().includes(appId.toLowerCase()));
        if (matched) return matched;
      }
    }

    // Priority 5: First non-helper message (filter out helper patterns)
    const nonHelperMessage = messageNames.find(
      (name) => !this.HELPER_MESSAGE_PATTERNS.some((pattern) => pattern.test(name))
    );
    if (nonHelperMessage) {
      this.logger.warn(`Using fallback root message: ${nonHelperMessage}. Consider adding explicit naming convention.`);
      return nonHelperMessage;
    }

    // Priority: Last resort - first alphabetical message
    this.logger.warn(
      `No clear root message found in [${messageNames.join(", ")}]. Using first alphabetical. Consider naming convention.`
    );
    return messageNames[0] ?? null;
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

  private extractFieldMetaFromOptions(options: string): {
    label?: string;
    required?: boolean;
    pattern?: string;
    listVisible?: boolean;
    uniqueKey?: boolean;
    widget?: string;
  } {
    const result: { label?: string; required?: boolean; pattern?: string; listVisible?: boolean; uniqueKey?: boolean; widget?: string } = {};
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

    const widget = this.extractStringOption(options, ["ui_widget"]);
    if (widget) result.widget = widget.trim().toLowerCase();

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
        // Fix: Replace \\ first, then \"
        // Input: \\\"
        // Correct: \" (not ")
        return raw
          .replace(/\\\\/g, "\\")
          .replace(/\\"/g, "\"");
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
    if (field.widget === "json") rules.push({ type: "json" });
    if (field.widget === "markdown") rules.push({ type: "markdown" });
    return rules;
  }

  /**
   * Validates regex pattern for syntax AND JavaScript semantics.
   * JavaScript doesn't support some regex features from other languages (e.g., named capture groups in some engines).
   *
   * @param pattern - The regex pattern to validate
   * @returns true if pattern is valid JavaScript regex, false otherwise
   */
  private isValidRegex(pattern: string): boolean {
    try {
      // Validate syntax
      const regex = new RegExp(pattern);

      // Test semantics by attempting to compile and test
      // This catches features like named capture groups that might not work
      try {
        regex.test(""); // Test with empty string
      } catch {
        return false;
      }

      // Check for features that are known to cause issues
      // Note: Most modern JS engines support named capture groups, but we check for obvious issues
      const problematicPatterns = [
        /\(\?P<[^>]+\)/,  // Python-style named capture groups (unsupported)
        /\(\?#.*\)/,       // Comments (unsupported in JS)
      ];

      for (const problematic of problematicPatterns) {
        if (problematic.test(pattern)) {
          this.logger.warn(`Regex pattern contains potentially unsupported feature: ${pattern}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.warn(`Invalid regex pattern: ${pattern} - ${error instanceof Error ? error.message : String(error)}`);
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
}
