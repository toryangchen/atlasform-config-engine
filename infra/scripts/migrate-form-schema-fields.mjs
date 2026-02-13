#!/usr/bin/env node
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lowcode_platform";
const APPLY = process.argv.includes("--apply");

function hasFields(doc) {
  return Array.isArray(doc?.schema?.fields);
}

function compareByFreshness(a, b) {
  const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return bt - at;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const forms = db.collection("forms");

  const all = await forms
    .find({}, { projection: { tenantId: 1, appId: 1, formName: 1, version: 1, schema: 1, createdAt: 1, updatedAt: 1 } })
    .toArray();

  const dirty = all.filter((doc) => !hasFields(doc));
  const clean = all.filter((doc) => hasFields(doc));

  console.log(`[migrate] total=${all.length} dirty=${dirty.length} clean=${clean.length}`);

  let matched = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of dirty) {
    const candidates = clean
      .filter(
        (c) =>
          String(c.tenantId || "") === String(doc.tenantId || "") &&
          String(c.appId || "") === String(doc.appId || "") &&
          String(c.formName || "") === String(doc.formName || "")
      )
      .sort(compareByFreshness);

    const source = candidates[0];

    if (!source) {
      skipped += 1;
      console.log(`[skip] ${doc._id} ${doc.formName}@${doc.version} no template fields found`);
      if (APPLY) {
        await forms.updateOne(
          { _id: doc._id },
          {
            $set: {
              schema: {
                ...(doc.schema || {}),
                formName: doc.schema?.formName || doc.formName,
                version: doc.schema?.version || doc.version,
                _migration: {
                  status: "needs-manual-fields",
                  at: new Date().toISOString(),
                  note: "No sibling version with schema.fields"
                }
              }
            }
          }
        );
      }
      continue;
    }

    matched += 1;
    const nextSchema = {
      ...(doc.schema || {}),
      formName: doc.schema?.formName || doc.formName,
      version: doc.schema?.version || doc.version,
      fields: source.schema.fields,
      _migration: {
        status: "auto-filled-fields",
        at: new Date().toISOString(),
        sourceFormId: String(source._id),
        sourceVersion: String(source.version)
      }
    };

    console.log(
      `[plan] ${doc._id} ${doc.formName}@${doc.version} <= ${source._id} ${source.formName}@${source.version} fields=${source.schema.fields.length}`
    );

    if (APPLY) {
      const res = await forms.updateOne({ _id: doc._id }, { $set: { schema: nextSchema } });
      if (res.modifiedCount > 0) updated += 1;
    }
  }

  console.log(
    `[done] apply=${APPLY} matched=${matched} updated=${updated} skipped=${skipped} unchanged=${dirty.length - updated - skipped}`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[migrate] failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
