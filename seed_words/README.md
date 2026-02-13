# Seed Word Data into Firestore (Hybrid Model)

Seeds Firestore with global word documents plus topic indexes for **biology**, **climate**, and **mindset**. Uses Datamuse for candidates and Free Dictionary API for definitions/phonetics.

## Prerequisites
- Node 18+ installed.
- A Firebase **service account** for the Word Nerd project.


## Install dependencies
```bash
cd seed_words
npm install
```

## Run the seeder
```bash
# from seed_words/
node seed.js biology
node seed.js climate
node seed.js mindset
```
You can run multiple times; topics are merged via `arrayUnion`, so a word can belong to more than one topic without overwriting existing data.

## Audits and reports
### Audit & delete bad words (supports dry-run)
```bash
# report only, no deletes
node audit_and_delete_bad_words.js --dry-run

# delete invalid words + topic references in batches
node audit_and_delete_bad_words.js
```
Validation rules:
- `definition`: non-empty string
- `example`: non-empty string (required)
- `meanings`: non-empty array AND at least one meaning with
  - non-empty `partOfSpeech`
  - non-empty `definitions` array containing at least one non-empty `definition`

Deletes are batched (<=450 ops) and remove both `/words/{wordId}` and `/topics/{topic}/words/{wordId}` across all topics.

### Audio coverage report
```bash
node audio_report.js
```
Prints total words, how many have `audioUrl`, how many are missing, plus first 25 IDs missing audio.

## What it does (per topic run)
1. Fetches up to 50 candidate words from Datamuse (falls back to small built‑in seed list if Datamuse is empty/unreachable).
2. Enriches each candidate via Free Dictionary API.
3. Skips words with no valid dictionary entry.
4. Writes each word **once** to `/words/{wordId}` (lowercase key).
5. Creates/updates `/topics/{topic}` and `/topics/{topic}/words/{wordId}` with a reference back to the global word.
6. Uses batched writes (<=450 ops per batch).
7. Logs counts: candidates, saved, skipped.

Collections written:
- `/words/{wordId}`: `word`, `wordId`, `meanings`, `definition`, `example`, `audioUrl`, `createdAt`, `updatedAt`
- `/topics/{topic}`: `name`, `updatedAt`
- `/topics/{topic}/words/{wordId}`: `wordRef`, `addedAt`

Run multiple topics; words are not duplicated—only topic indexes are added.
