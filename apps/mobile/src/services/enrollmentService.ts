import {
    collection,
    doc,
    getDocs,
    query,
    limit,
    writeBatch,
    serverTimestamp,
    documentId,
    where,
  } from "firebase/firestore";
  import { db } from "../firebase/firebase";
  
  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  };
  
  export const enrollTopicForUser = async (
    uid: string,
    topicId: string,
    take = 150
  ) => {
    const topicWordsRef = collection(db, "topics", topicId, "words");
    const topicSnap = await getDocs(query(topicWordsRef, limit(take)));
  
    const wordIds = topicSnap.docs.map((d) => d.id);
    if (wordIds.length === 0) return;
  
    const userWordsCol = collection(db, "users", uid, "userWords");
  
    const existing = new Set<string>();
    for (const idsChunk of chunk(wordIds, 10)) {
      const existingSnap = await getDocs(
        query(userWordsCol, where(documentId(), "in", idsChunk))
      );
      existingSnap.forEach((doc) => existing.add(doc.id));
    }
  
    const missing = wordIds.filter((id) => !existing.has(id));
    if (missing.length === 0) return;
  
    for (const idsChunk of chunk(missing, 400)) {
      const batch = writeBatch(db);
  
      for (const wordId of idsChunk) {
        const userWordRef = doc(db, "users", uid, "userWords", wordId);
        const globalWordRef = doc(db, "words", wordId);
  
        batch.set(userWordRef, {
          wordId,
          wordRef: globalWordRef,
          topics: [topicId],
          status: "learning",
          seenCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          isFavorite: false,
          intervalDays: 0,
          easeFactor: 2.5,
          lastReviewedAt: null,
          nextReviewAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
  
      await batch.commit();
    }
  };
  