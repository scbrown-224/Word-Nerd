/* Audit /words and delete invalid entries (and their topic index references).
 *
 * Usage:
 *   node audit_and_delete_bad_words.js
 *   node audit_and_delete_bad_words.js --dry-run
 *
 * Criteria for a VALID word:
 * - definition: non-empty string
 * - example: non-empty string
 * - meanings: non-empty array
 *   - at least one meaning has a non-empty partOfSpeech
 *   - that meaning has a non-empty definitions array
 *   - at least one definition has a non-empty definition field
 *
 * Invalid words are deleted from:
 * - /words/{wordId}
 * - /topics/{topic}/words/{wordId} for all topics
 *
 * Uses batched writes (<= 450 ops) to stay under Firestore limits.
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const BATCH_LIMIT = 450;
const DRY_RUN = process.argv.includes("--dry-run");

function requireServiceAccount() {
  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) {
    console.error("Missing serviceAccountKey.json in seed_words/");
    process.exit(1);
  }
  return require(keyPath);
}

function initAdmin() {
  admin.initializeApp({
    credential: admin.credential.cert(requireServiceAccount()),
  });
  return admin.firestore();
}

function isValidString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidWord(doc) {
  if (!doc) return false;
  if (!isValidString(doc.definition)) return false;
  if (!isValidString(doc.example)) return false;
  if (!Array.isArray(doc.meanings) || doc.meanings.length === 0) return false;

  const okMeaning = doc.meanings.some((m) => {
    if (!m) return false;
    if (!isValidString(m.partOfSpeech)) return false;
    if (!Array.isArray(m.definitions) || m.definitions.length === 0) return false;
    return m.definitions.some((d) => d && isValidString(d.definition));
  });

  return okMeaning;
}

async function listTopics(db) {
  const snap = await db.collection("topics").get();
  return snap.docs.map((d) => d.id);
}

async function main() {
  const db = initAdmin();
  const topics = await listTopics(db);
  console.log(`Found ${topics.length} topics`);

  const wordsSnap = await db.collection("words").get();
  console.log(`Scanning ${wordsSnap.size} word docs...`);

  let scanned = 0;
  let valid = 0;
  let deleted = 0;
  const deletedIds = [];

  let batch = db.batch();
  let ops = 0;

  const flush = async () => {
    if (ops === 0 || DRY_RUN) {
      ops = 0;
      batch = db.batch();
      return;
    }
    await batch.commit();
    ops = 0;
    batch = db.batch();
  };

  for (const doc of wordsSnap.docs) {
    scanned += 1;
    const data = doc.data();
    if (isValidWord(data)) {
      valid += 1;
      continue;
    }

    // mark for deletion
    deleted += 1;
    deletedIds.push(doc.id);

    if (ops + (1 + topics.length) > BATCH_LIMIT) {
      await flush();
    }

    if (!DRY_RUN) {
      batch.delete(doc.ref);
      ops += 1;

      for (const topic of topics) {
        const ref = db.collection("topics").doc(topic).collection("words").doc(doc.id);
        batch.delete(ref);
        ops += 1;
        if (ops >= BATCH_LIMIT - 5) {
          await flush();
        }
      }
    }
  }

  await flush();

  console.log("Audit complete");
  console.log({
    scanned,
    valid,
    deleted,
    dryRun: DRY_RUN,
    sampleDeleted: deletedIds.slice(0, 10),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
