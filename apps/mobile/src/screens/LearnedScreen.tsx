import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type Word = {
  wordId: string;
  word: string;
  definition: string;
  example: string | null;
  topics?: string[];
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

export default function LearnedScreen() {
  const [learnedWords, setLearnedWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLearnedWords = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLearnedWords([]);
        setLoading(false);
        return;
      }

      try {
        const userWordsCol = collection(db, "users", user.uid, "userWords");
        const userWordsSnap = await getDocs(userWordsCol);

        const seenWordIds = userWordsSnap.docs
          .filter((docSnap) => {
            const data = docSnap.data() as any;
            return (data.seenCount ?? 0) > 0;
          })
          .map((docSnap) => docSnap.id);

        if (seenWordIds.length === 0) {
          setLearnedWords([]);
          setLoading(false);
          return;
        }

        const fetched: Word[] = [];
        const idChunks = chunk(seenWordIds, 10);

        for (const ids of idChunks) {
          const wordsCol = collection(db, "words");
          const qWords = query(wordsCol, where(documentId(), "in", ids));
          const wordsSnap = await getDocs(qWords);

          wordsSnap.forEach((wordDoc) => {
            const data = wordDoc.data() as any;
            fetched.push({
              wordId: data.wordId ?? wordDoc.id,
              word: data.word ?? wordDoc.id,
              definition: data.definition ?? "",
              example: data.example ?? null,
              topics: data.topics ?? [],
            });
          });
        }

        fetched.sort((a, b) => a.word.localeCompare(b.word));
        setLearnedWords(fetched);
      } catch (e) {
        console.log("Failed to load learned words:", e);
        setLearnedWords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLearnedWords();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Learned</Text>
      <Text style={styles.subtitle}>
        Words you’ve already come across on the Learn tab
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your words</Text>

        {loading ? (
          <Text style={styles.bodyText}>Loading words…</Text>
        ) : learnedWords.length === 0 ? (
          <Text style={styles.bodyText}>
            No words yet. Go through a few words on the Learn tab first.
          </Text>
        ) : (
          <View style={styles.wordList}>
            {learnedWords.map((w) => (
              <View key={w.wordId} style={styles.wordCard}>
                <Text style={styles.wordText}>{w.word}</Text>
                {!!w.definition && (
                  <Text style={styles.definitionText}>{w.definition}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stats</Text>
        <Text style={styles.bodyText}>
          Total seen words: {learnedWords.length}
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
  wordList: { gap: 10 },
  wordCard: {
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9a3412",
    textTransform: "capitalize",
  },
  definitionText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
});