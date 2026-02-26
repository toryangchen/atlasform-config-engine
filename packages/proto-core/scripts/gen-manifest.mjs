#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_DIR = resolve(new URL(".", import.meta.url).pathname, "../../..");
const PROTO_DIR = resolve(ROOT_DIR, "packages/proto-core/proto");
const OUT_FILE = resolve(ROOT_DIR, "packages/shared-types/src/generated/lowcode-manifest.ts");

function stripBlockComments(input) {
  return input.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractBlocks(text, kind) {
  const result = [];
  const regex = new RegExp(`\\b${kind}\\s+([A-Za-z_]\\w*)\\s*\\{`, "g");
  let m = null;
  while ((m = regex.exec(text))) {
    const name = m[1];
    const startBrace = regex.lastIndex - 1;
    const endBrace = findMatchingBrace(text, startBrace);
    if (endBrace < 0) continue;
    const body = text.slice(startBrace + 1, endBrace);
    result.push({ name, body });
    regex.lastIndex = endBrace + 1;
  }
  return result;
}

function findMatchingBrace(text, openPos) {
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

function removeInnerBlocks(body) {
  let out = "";
  let depth = 0;
  let inLineComment = false;
  let inString = false;
  let quoteChar = "";
  let escaping = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
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

function extractOptionsSegment(statement) {
  const semiIndex = statement.lastIndexOf(";");
  const end = semiIndex >= 0 ? semiIndex : statement.length;
  const open = statement.indexOf("[");
  if (open < 0) return "";
  const close = statement.lastIndexOf("]", end);
  if (close < 0 || close <= open) return "";
  return statement.slice(open + 1, close);
}

function extractStringOption(options, keys) {
  for (const key of keys) {
    const match = options.match(new RegExp(`\\((?:[\\w.]+\\.)?${key}\\)\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "i"));
    if (match && typeof match[1] === "string") {
      return match[1].replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
    }
  }
  return undefined;
}

function extractBooleanOption(options, keys) {
  for (const key of keys) {
    const match = options.match(new RegExp(`\\((?:[\\w.]+\\.)?${key}\\)\\s*=\\s*(true|false)`, "i"));
    if (match?.[1]) return match[1].toLowerCase() === "true";
  }
  return undefined;
}

function extractFieldMetaFromComment(comment) {
  const result = {};
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
    if (!token) result.required = true;
    else result.required = token === "true" || token === "1" || token === "yes";
  }

  const patternMatch = comment.match(/@(pattern|regex)\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
  if (patternMatch?.[2]) {
    const raw = patternMatch[2].trim();
    const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    const pattern = unquoted.replace(/\\\\/g, "\\");
    if (isValidRegex(pattern)) result.pattern = pattern;
  }

  const listMatch = comment.match(/@(list|table|list_visible)(?:\s*[:=]?\s*(true|false|1|0|yes|no))?/i);
  if (listMatch) {
    const token = listMatch[2]?.toLowerCase();
    if (!token) result.listVisible = true;
    else result.listVisible = token === "true" || token === "1" || token === "yes";
  }

  const uniqueMatch = comment.match(/@(unique|unique_key|uk)(?:\s*[:=]?\s*(true|false|1|0|yes|no))?/i);
  if (uniqueMatch) {
    const token = uniqueMatch[2]?.toLowerCase();
    if (!token) result.uniqueKey = true;
    else result.uniqueKey = token === "true" || token === "1" || token === "yes";
  }
  return result;
}

function extractFieldMetaFromOptions(options) {
  const result = {};
  if (!options) return result;
  const label = extractStringOption(options, ["ui_label"]);
  if (label) result.label = label;

  const required = extractBooleanOption(options, ["ui_required"]);
  if (typeof required === "boolean") result.required = required;

  const pattern = extractStringOption(options, ["ui_pattern"]);
  if (pattern) {
    const normalized = pattern.replace(/\\\\/g, "\\");
    if (isValidRegex(normalized)) result.pattern = normalized;
  }

  const listVisible = extractBooleanOption(options, ["ui_list"]);
  if (typeof listVisible === "boolean") result.listVisible = listVisible;

  const uniqueKey = extractBooleanOption(options, ["ui_unique"]);
  if (typeof uniqueKey === "boolean") result.uniqueKey = uniqueKey;

  const widget = extractStringOption(options, ["ui_widget"]);
  if (widget) result.widget = widget.trim().toLowerCase();
  return result;
}

function extractEnumValueMetaFromComment(comment) {
  const result = {};
  if (!comment) return result;
  const labelMatch = comment.match(/@label\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
  if (labelMatch?.[1]) result.label = labelMatch[1].trim();
  const valueMatch = comment.match(/@value\s*[:=]?\s*(.+?)(?=\s+@[A-Za-z_]\w*|$)/i);
  if (valueMatch?.[1]) {
    const value = valueMatch[1].trim();
    if (value) result.value = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return result;
}

function extractEnumValueMetaFromOptions(options) {
  const result = {};
  if (!options) return result;
  const label = extractStringOption(options, ["ui_enum_label"]);
  if (label) result.label = label;
  const value = extractStringOption(options, ["ui_enum_value"]);
  if (value !== undefined) result.value = value;
  return result;
}

function toLabel(name) {
  const text = name.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toEnumLabel(name) {
  const normalized = name.replace(/_UNSPECIFIED$/i, "").replace(/_/g, " ").trim().toLowerCase();
  if (!normalized) return name;
  return normalized
    .split(/\s+/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scalarKind(type) {
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

function isValidRegex(pattern) {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function parseMessages(text) {
  const out = new Map();
  const blocks = extractBlocks(text, "message");
  for (const block of blocks) {
    const body = removeInnerBlocks(block.body);
    const fields = [];
    let pendingMeta = {};
    let statement = "";
    let statementMeta = {};
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("//") && !statement) {
        pendingMeta = { ...pendingMeta, ...extractFieldMetaFromComment(line.replace(/^\/\//, "").trim()) };
        continue;
      }

      const inlineCommentIndex = line.indexOf("//");
      const codePart = inlineCommentIndex >= 0 ? line.slice(0, inlineCommentIndex).trim() : line;
      const inlineComment = inlineCommentIndex >= 0 ? line.slice(inlineCommentIndex + 2).trim() : "";
      statementMeta = { ...statementMeta, ...extractFieldMetaFromComment(inlineComment) };
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

      const optionMeta = extractFieldMetaFromOptions(extractOptionsSegment(statement));
      const merged = { ...pendingMeta, ...statementMeta, ...optionMeta };
      const next = {
        repeated: Boolean(m[1]),
        type: m[2].split(".").pop(),
        name: m[3]
      };
      if (merged.label) next.label = merged.label;
      if (typeof merged.required === "boolean") next.required = merged.required;
      if (typeof merged.pattern === "string") next.pattern = merged.pattern;
      if (typeof merged.listVisible === "boolean") next.listVisible = merged.listVisible;
      if (typeof merged.uniqueKey === "boolean") next.uniqueKey = merged.uniqueKey;
      if (typeof merged.widget === "string") next.widget = merged.widget;
      fields.push(next);
      pendingMeta = {};
      statementMeta = {};
      statement = "";
    }
    out.set(block.name, { name: block.name, fields });
  }
  return out;
}

function parseEnums(text) {
  const out = new Map();
  const blocks = extractBlocks(text, "enum");
  for (const block of blocks) {
    const values = [];
    let statement = "";
    let statementComment = "";
    for (const raw of block.body.split("\n")) {
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

      const optionMeta = extractEnumValueMetaFromOptions(extractOptionsSegment(statement));
      const commentMeta = extractEnumValueMetaFromComment(statementComment);
      const meta = { ...commentMeta, ...optionMeta };
      const enumKey = m[1];
      values.push({
        label: meta.label ?? toEnumLabel(enumKey),
        value: meta.value ?? enumKey
      });
      statement = "";
      statementComment = "";
    }
    out.set(block.name, { name: block.name, values });
  }
  return out;
}

function pickRootMessage(appId, messages) {
  const expect = appId
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") + "Form";
  if (messages.has(expect)) return expect;
  if (messages.has("FormSchema")) return "FormSchema";
  const blacklist = new Set(["ValidationRule", "Field", "ProfileFormPreset"]);
  const fallback = [...messages.keys()].find((name) => !blacklist.has(name));
  return fallback ?? null;
}

function buildRules(field) {
  const rules = [];
  if (field.pattern) rules.push({ type: "pattern", value: field.pattern });
  if (field.widget === "json") rules.push({ type: "json" });
  if (field.widget === "markdown") rules.push({ type: "markdown" });
  return rules;
}

function toSchemaField(field, messages, enums) {
  const scalar = scalarKind(field.type);
  const label = field.label ?? toLabel(field.name);
  const required = Boolean(field.required);
  const rules = buildRules(field);
  const listVisible = Boolean(field.listVisible);
  const uniqueKey = Boolean(field.uniqueKey);
  const base = { name: field.name, label, required, rules, list_visible: listVisible, unique_key: uniqueKey };

  if (field.repeated) {
    if (scalar === "string") {
      if (field.widget === "image") return { ...base, type: "array-image" };
      return { ...base, type: "array", item_type: "string" };
    }
    if (scalar === "number") return { ...base, type: "array", item_type: "number" };
    if (scalar === "boolean") return { ...base, type: "checkbox-group", options: ["true", "false"] };
    const enumDef = enums.get(field.type);
    if (enumDef) return { ...base, type: "checkbox-group", options: enumDef.values };
    const obj = messages.get(field.type);
    if (obj) {
      return {
        ...base,
        type: "array<object>",
        item_object_fields: obj.fields.map((f) => toSchemaField(f, messages, enums)).filter(Boolean)
      };
    }
    return null;
  }

  if (scalar === "string") {
    const widget = field.widget?.trim().toLowerCase();
    const type = widget === "textarea" || widget === "markdown" || widget === "json" || widget === "image" ? widget : "string";
    return { ...base, type };
  }
  if (scalar === "number") return { ...base, type: "number" };
  if (scalar === "boolean") return { ...base, type: "switch" };
  const enumDef = enums.get(field.type);
  if (enumDef) return { ...base, type: "select", options: enumDef.values };
  const obj = messages.get(field.type);
  if (obj) {
    return {
      ...base,
      type: "object",
      object_fields: obj.fields.map((f) => toSchemaField(f, messages, enums)).filter(Boolean)
    };
  }
  return null;
}

function parseFileMeta(content) {
  return {
    appName: extractStringOption(content, ["app_name"]),
    appDescription: extractStringOption(content, ["app_description"])
  };
}

function titleize(input) {
  return input
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildManifest() {
  const apps = [];
  const formsByApp = {};
  const files = readdirSync(PROTO_DIR).filter((f) => f.endsWith(".proto"));
  for (const file of files) {
    if (file.startsWith("common.")) continue;
    const appId = file.replace(/\.proto$/i, "");
    const fullPath = resolve(PROTO_DIR, file);
    const content = readFileSync(fullPath, "utf-8");
    const clean = stripBlockComments(content);
    const messages = parseMessages(clean);
    const enums = parseEnums(clean);
    if (!messages.size) continue;
    const rootName = pickRootMessage(appId, messages);
    if (!rootName) continue;
    const root = messages.get(rootName);
    if (!root) continue;
    const fields = root.fields.map((f) => toSchemaField(f, messages, enums)).filter(Boolean);
    const fileMeta = parseFileMeta(content);
    apps.push({
      appId,
      name: fileMeta.appName ?? titleize(appId),
      description: fileMeta.appDescription ?? `Generated from ${file}`,
      protoFile: file
    });
    formsByApp[appId] = [
      {
        _id: `generated-${appId}-${root.name}`,
        appId,
        formName: root.name,
        version: "1.0.0",
        status: "published",
        schema: { fields }
      }
    ];
  }
  apps.sort((a, b) => a.appId.localeCompare(b.appId));
  return { apps, formsByApp };
}

const manifest = buildManifest();
const output = `/* eslint-disable */
// Code generated by packages/proto-core/scripts/gen-manifest.mjs. DO NOT EDIT.

export const generatedManifest = ${JSON.stringify(manifest, null, 2)} as const;
`;

writeFileSync(OUT_FILE, output, "utf-8");
console.log(`manifest generated to ${OUT_FILE}`);
