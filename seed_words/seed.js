/* Seed Firestore with topic-based words using a hybrid model.
 *
 * Usage: node seed.js <topic>
 * Topics supported: biology | climate | mindset
 *
 * Writes:
 * - /words/{wordId} (global single source of truth)
 * - /topics/{topic} and /topics/{topic}/words/{wordId} (topic index pointing at the word)
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const pLimit = require("p-limit");

const VALID_TOPICS = new Set(["biology", "climate", "mindset"]);
const MAX_CANDIDATES = 50;
const CONCURRENCY = 6;
const BATCH_LIMIT = 450; // keep under Firestore 500 write limit

const TOPIC_SEEDS = {
  biology: ["biology", "cell", "enzyme", "genetics", "organism", "ecosystem", "protein", "evolution"],
  climate: ["climate", "carbon", "warming", "feedback", "sequester", "emissions", "mitigation", "adaptation"],
  mindset: ["resilience", "focus", "growth", "discipline", "grit", "mindset", "habits", "motivation"],
};

async function main() {
  const topic = (process.argv[2] || "").toLowerCase();
  if (!VALID_TOPICS.has(topic)) {
    console.error(`Topic required. Usage: node seed.js <biology|climate|mindset>`);
    process.exit(1);
  }

  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) {
    console.error(`Missing service account file at ${keyPath}`);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
  });

  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  console.log(`→ Seeding topic: ${topic}`);

  const candidates = await fetchCandidates(topic);
  console.log(`Fetched ${candidates.length} candidate words`);

  const limit = (pLimit.default || pLimit)(CONCURRENCY);
  let enriched = 0;
  let skipped = 0;
  let saved = 0;

  let batch = db.batch();
  let batchOps = 0;

  const flush = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  const tasks = candidates.map((word) =>
    limit(async () => {
      const enrichedWord = await enrichWord(word);
      if (!enrichedWord) {
        skipped += 1;
        return;
      }
      enriched += 1;

      const wordRef = db.collection("words").doc(enrichedWord.wordId);
      const topicRef = db.collection("topics").doc(topic);
      const topicWordRef = topicRef.collection("words").doc(enrichedWord.wordId);

      const wordData = {
        ...enrichedWord,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const topicData = {
        name: topic,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (batchOps + 3 > BATCH_LIMIT) {
        await flush();
      }

      batch.set(wordRef, wordData, { merge: true });
      batch.set(topicRef, topicData, { merge: true });
      batch.set(
        topicWordRef,
        {
          wordRef,
          addedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batchOps += 3;
      saved += 1;
    })
  );

  await Promise.all(tasks);
  await flush();

  console.log("Done.");
  console.log({ candidates: candidates.length, enriched, skipped, saved });
  process.exit(0);
}

async function fetchCandidates(topic) {
  const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(
    topic
  )}&topics=${encodeURIComponent(topic)}&max=${MAX_CANDIDATES}`;
  let words = [];
  try {
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) throw new Error(`Datamuse error: ${res.status}`);
    const data = await res.json();
    words = data
      .map((item) => (item && item.word ? String(item.word).trim() : null))
      .filter(Boolean);
  } catch (err) {
    console.warn(`Datamuse fetch failed (${err.message}); falling back to seeds for ${topic}.`);
  }

  const seeds = TOPIC_SEEDS[topic] || [];
  const combined = [...words, ...seeds];

  // de-duplicate and keep simple words (no spaces)
  return Array.from(new Set(combined.map((w) => w.toLowerCase()))).filter((w) => /^[a-z-]+$/.test(w));
}

async function enrichWord(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null; // skip missing entries
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const entry = data[0];
  const meanings = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((m) => {
          const defs = Array.isArray(m.definitions) ? m.definitions.slice(0, 3) : [];
          const mappedDefs = defs
            .map((d) => ({
              definition: d.definition,
              example: d.example || null,
            }))
            .filter((d) => d.definition);
          if (!mappedDefs.length) return null;
          return { partOfSpeech: m.partOfSpeech || "unknown", definitions: mappedDefs };
        })
        .filter(Boolean)
    : [];

  if (!meanings.length) return null;

  const firstDef = meanings[0].definitions[0];
  const audioUrl = firstAudio(entry.phonetics);

  return {
    word,
    wordId: word.toLowerCase(),
    meanings,
    definition: firstDef.definition,
    example: firstDef.example || null,
    audioUrl: audioUrl || null,
  };
}

function firstAudio(phonetics) {
  if (!Array.isArray(phonetics)) return null;
  const hit = phonetics.find((p) => p && p.audio);
  return hit ? hit.audio : null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
