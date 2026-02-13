/* Audio coverage report for /words.
 *
 * Usage:
 *   node audio_report.js
 *
 * Prints:
 * - total words
 * - with audioUrl
 * - missing/empty audioUrl
 * - first 25 wordIds missing audio
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

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

async function main() {
  const db = initAdmin();
  const snap = await db.collection("words").get();

  let total = 0;
  let withAudio = 0;
  const missing = [];

  for (const doc of snap.docs) {
    total += 1;
    const { audioUrl } = doc.data();
    if (audioUrl && typeof audioUrl === "string" && audioUrl.trim().length > 0) {
      withAudio += 1;
    } else {
      missing.push(doc.id);
    }
  }

  console.log("Audio report:");
  console.log({ total, withAudio, missing: total - withAudio });
  console.log("First 25 missing audio wordIds:");
  console.log(missing.slice(0, 25));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
