#!/usr/bin/env node
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lowcode_platform";
const APPLY = process.argv.includes("--apply");

function freshnessTs(doc) {
  return new Date(doc.updatedAt || doc.createdAt || 0).getTime();
}

function groupKey(doc) {
  return `${String(doc.tenantId || "")}::${String(doc.appId || "")}::${String(doc.formName || "")}`;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const forms = db.collection("forms");

  const all = await forms
    .find({}, { projection: { tenantId: 1, appId: 1, formName: 1, version: 1, status: 1, schema: 1, createdAt: 1, updatedAt: 1 } })
    .toArray();

  const buckets = new Map();
  for (const row of all) {
    const key = groupKey(row);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  let keepCount = 0;
  let removeCount = 0;
  let updatedCount = 0;

  for (const [, list] of buckets) {
    if (list.length === 0) continue;
    list.sort((a, b) => freshnessTs(b) - freshnessTs(a));
    const keep = list[0];
    const stale = list.slice(1);
    keepCount += 1;
    removeCount += stale.length;

    console.log(
      `[plan] keep=${keep._id} ${keep.appId}/${keep.formName}@${keep.version} stale=${stale.map((x) => String(x._id)).join(",") || "-"}`
    );

    if (!APPLY) continue;

    const nextSchema = {
      ...(keep.schema || {}),
      formName: keep.schema?.formName || keep.formName,
      version: keep.schema?.version || keep.version
    };

    const updateRes = await forms.updateOne(
      { _id: keep._id },
      {
        $set: {
          status: "published",
          version: keep.version,
          schema: nextSchema
        }
      }
    );
    if (updateRes.modifiedCount > 0) updatedCount += 1;

    if (stale.length > 0) {
      await forms.deleteMany({ _id: { $in: stale.map((x) => x._id) } });
    }
  }

  console.log(`[done] apply=${APPLY} groups=${buckets.size} keep=${keepCount} remove=${removeCount} updated=${updatedCount}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[compact-form-versions] failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
