import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  documentId,
  Timestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type ReviewWord = {
  wordId: string;
  word: string;
  definition: string;
  example: string | null;
  intervalDays: number;
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const getNextInterval = (currentInterval: number) => {
  if (currentInterval <= 1) return 3;
  if (currentInterval <= 3) return 7;
  if (currentInterval <= 7) return 14;
  return 30;
};

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
};

export default function ReviewScreen() {
  const [dueWords, setDueWords] = useState<ReviewWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDueWords = async () => {
      const user = auth.currentUser;
      if (!user) {
        setDueWords([]);
        setLoading(false);
        return;
      }

      try {
        const userWordsCol = collection(db, "users", user.uid, "userWords");
        const dueQuery = query(
          userWordsCol,
          where("nextReviewAt", "<=", Timestamp.now())
        );

        const dueSnap = await getDocs(dueQuery);

        if (dueSnap.empty) {
          setDueWords([]);
          setLoading(false);
          return;
        }

        const progressMap = new Map<
          string,
          { intervalDays: number }
        >();

        dueSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          progressMap.set(docSnap.id, {
            intervalDays: data.intervalDays ?? 1,
          });
        });

        const wordIds = Array.from(progressMap.keys());
        const fetched: ReviewWord[] = [];

        for (const ids of chunk(wordIds, 10)) {
          const wordsCol = collection(db, "words");
          const qWords = query(wordsCol, where(documentId(), "in", ids));
          const wordsSnap = await getDocs(qWords);

          wordsSnap.forEach((wordDoc) => {
            const data = wordDoc.data() as any;
            const progress = progressMap.get(wordDoc.id);

            fetched.push({
              wordId: data.wordId ?? wordDoc.id,
              word: data.word ?? wordDoc.id,
              definition: data.definition ?? "",
              example: data.example ?? null,
              intervalDays: progress?.intervalDays ?? 1,
            });
          });
        }

        fetched.sort((a, b) => a.word.localeCompare(b.word));
        setDueWords(fetched);
      } catch (e) {
        console.log("Failed to load due review words:", e);
        setDueWords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDueWords();
  }, []);

  const current = useMemo(() => {
    if (!dueWords.length) return null;
    return dueWords[index];
  }, [dueWords, index]);

  const goNext = () => {
    setShowDefinition(false);
    setDueWords((prev) => prev.filter((_, i) => i !== index));
    setIndex(0);
  };

  const handleReview = async (knewIt: boolean) => {
    const user = auth.currentUser;
    if (!user || !current) return;
  
    setSaving(true);
  
    try {
      const userWordRef = doc(db, "users", user.uid, "userWords", current.wordId);
      const nextInterval = knewIt ? getNextInterval(current.intervalDays) : 1;
  
      await updateDoc(userWordRef, {
        intervalDays: nextInterval,
        nextReviewAt: addDays(nextInterval),
        lastReviewedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        correctCount: knewIt ? increment(1) : increment(0),
        incorrectCount: knewIt ? increment(0) : increment(1),
        status: knewIt && nextInterval >= 14 ? "learned" : "learning",
      });
  
      goNext();
    } catch (e) {
      console.log("Failed to update review schedule:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Review</Text>
      <Text style={styles.subtitle}>Words due for review right now</Text>

      <View style={styles.card}>
        {loading ? (
          <Text style={styles.bodyText}>Loading review queue…</Text>
        ) : !current ? (
          <>
            <Text style={styles.cardTitle}>You’re all caught up</Text>
            <Text style={styles.bodyText}>
              No words are due right now. Learn a few words first or come back later.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>Due now</Text>
              <Text style={styles.badge}>Interval: {current.intervalDays} day{current.intervalDays === 1 ? "" : "s"}</Text>
            </View>

            <View style={styles.wordBlock}>
              <Text style={styles.word}>{current.word}</Text>
            </View>

            {showDefinition && (
              <View style={styles.definitionArea}>
                <View style={styles.definitionCard}>
                  <Text style={styles.definitionLabel}>Definition</Text>
                  <Text style={styles.definitionText}>{current.definition}</Text>
                </View>

                {!!current.example && (
                  <View style={styles.exampleCard}>
                    <Text style={styles.exampleLabel}>Example</Text>
                    <Text style={styles.exampleText}>"{current.example}"</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.actions}>
              {!showDefinition ? (
                <Pressable
                  style={[styles.button, styles.revealButton]}
                  onPress={() => setShowDefinition(true)}
                >
                  <Text style={styles.revealText}>Show Definition</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={[styles.button, styles.knowButton]}
                    onPress={() => handleReview(true)}
                    disabled={saving}
                  >
                    <Text style={styles.buttonText}>Got it</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.button, styles.practiceButton]}
                    onPress={() => handleReview(false)}
                    disabled={saving}
                  >
                    <Text style={styles.buttonText}>Need more practice</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Queue</Text>
        <Text style={styles.bodyText}>
          {loading ? "Loading…" : `${dueWords.length} word${dueWords.length === 1 ? "" : "s"} currently due`}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, backgroundColor: "#fff7ed" },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#475569" },
  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffedd5",
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  bodyText: { color: "#475569" },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    fontSize: 12,
    color: "#9a3412",
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  wordBlock: { alignItems: "center", paddingVertical: 8 },
  word: { fontSize: 34, fontWeight: "800", color: "#0f172a" },
  definitionArea: { gap: 10 },
  definitionCard: { backgroundColor: "#fff1e6", borderRadius: 16, padding: 14 },
  definitionLabel: { color: "#c2410c", fontWeight: "700", marginBottom: 4, fontSize: 12 },
  definitionText: { color: "#0f172a", fontSize: 14, lineHeight: 20 },
  exampleCard: { backgroundColor: "#fffbeb", borderRadius: 16, padding: 14 },
  exampleLabel: { color: "#b45309", fontWeight: "700", marginBottom: 4, fontSize: 12 },
  exampleText: { color: "#475569", fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  actions: { gap: 10, marginTop: 4 },
  button: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
  },
  revealButton: { backgroundColor: "#e2e8f0" },
  knowButton: { backgroundColor: "#22c55e" },
  practiceButton: { backgroundColor: "#f97316" },
  buttonText: { color: "white", fontWeight: "800" },
  revealText: { color: "#0f172a", fontWeight: "800" },
});