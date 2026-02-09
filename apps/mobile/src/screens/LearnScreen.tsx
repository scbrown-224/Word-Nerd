import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { auth } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";


type WordCard = {
  id: string; // Firestore doc id
  word: string;
  definition: string;
  example: string;
};

type ProgressMap = Record<string, { correct: number; status: "learning" | "learned" }>;

export default function LearnScreen() {
  const [words, setWords] = useState<WordCard[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);

  const [index, setIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, "words"), limit(50));
        const snap = await getDocs(q);

        const loaded: WordCard[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            word: data.word,
            definition: data.definition,
            example: data.example,
          };
        });

        setWords(loaded);
      } finally {
        setLoadingWords(false);
      }
    };

    load();
  }, []);

  const current = useMemo(() => words[index], [words, index]);

  // Loading / empty guards (prevents crashes)
  if (loadingWords) {
    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Learn</Text>
        <Text style={styles.skipText}>Loading words…</Text>
      </ScrollView>
    );
  }

  if (words.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Learn</Text>
        <Text style={styles.skipText}>No words found in Firestore.</Text>
      </ScrollView>
    );
  }

  const correctCount = progress[current.id]?.correct ?? 0;
  const progressPct = Math.min((correctCount / 3) * 100, 100);

  const next = () => {
    setShowDefinition(false);
    setIndex((prev) => (prev + 1) % words.length);
  };

  // helper function to track words
  const trackUserWord = async (wordId: string, action: "know" | "dontKnow") => {
    const u = auth.currentUser;
    if (!u) return;
  
    const userWordRef = doc(db, "users", u.uid, "userWords", wordId);
    const snap = await getDoc(userWordRef);
  
    // Create if missing
    if (!snap.exists()) {
      await setDoc(userWordRef, {
        wordRef: doc(db, "words", wordId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        seenCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        status: "learning",
        isFavorite: false,
        isBookmarked: false,
      });
    }
  
    // Update counts based on action
    if (action === "know") {
      await updateDoc(userWordRef, {
        seenCount: increment(1),
        correctCount: increment(1),
        updatedAt: serverTimestamp(),
        // optional: mark learned if you want later
      });
    } else {
      await updateDoc(userWordRef, {
        seenCount: increment(1),
        incorrectCount: increment(1),
        updatedAt: serverTimestamp(),
        status: "learning",
      });
    }
  };
  

  const handleKnow = async () => {
    await trackUserWord(current.id, "know");
  
    setProgress((prev) => {
      const currentCorrect = prev[current.id]?.correct ?? 0;
      const nextCorrect = currentCorrect + 1;
      const status = nextCorrect >= 3 ? "learned" : "learning";
      return { ...prev, [current.id]: { correct: nextCorrect, status } };
    });
  
    if (correctCount + 1 >= 3) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        next();
      }, 1200);
    } else {
      next();
    }
  };  

  const handleDontKnow = async () => {
    await trackUserWord(current.id, "dontKnow");
    setShowDefinition(true);
  };  

  const handleContinue = () => {
    setShowDefinition(false);
    next();
  };

  const skip = () => {
    setShowDefinition(false);
    next();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.progressHeader}>
        <Text style={styles.header}>Learn</Text>
        <Text style={styles.subtitle}>
          {index + 1}/{words.length}
        </Text>
        <View style={styles.topProgress}>
          <View style={[styles.topProgressFill, { width: `${((index + 1) / words.length) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.cardShell}>
        {showSuccess ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Word Learned!</Text>
            <Text style={styles.successText}>Great job!</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {/* Badges removed for now since Firestore words currently only have word/definition/example.
                (Styling unchanged—this section is just not rendered.) */}

            <View style={styles.wordBlock}>
              <Text style={styles.word}>{current.word}</Text>
              {correctCount > 0 && (
                <View style={styles.wordProgress}>
                  <View style={[styles.wordProgressFill, { width: `${progressPct}%` }]} />
                </View>
              )}
              {correctCount > 0 && <Text style={styles.wordProgressLabel}>{correctCount} / 3 correct</Text>}
            </View>

            {showDefinition && (
              <View style={styles.definitionArea}>
                <View style={styles.definitionCard}>
                  <Text style={styles.definitionLabel}>Definition</Text>
                  <Text style={styles.definitionText}>{current.definition}</Text>
                </View>
                <View style={styles.exampleCard}>
                  <Text style={styles.exampleLabel}>Example</Text>
                  <Text style={styles.exampleText}>"{current.example}"</Text>
                </View>
              </View>
            )}

            <View style={styles.actions}>
              {!showDefinition ? (
                <>
                  <Pressable style={[styles.button, styles.knowButton]} onPress={handleKnow}>
                    <Text style={styles.buttonIcon}>✓</Text>
                    <Text style={styles.buttonText}>I Know This Word</Text>
                  </Pressable>
                  <Pressable style={[styles.button, styles.revealButton]} onPress={handleDontKnow}>
                    <Text style={styles.buttonIcon}>?</Text>
                    <Text style={styles.revealText}>Show Definition</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={[styles.button, styles.continueButton]} onPress={handleContinue}>
                  <Text style={styles.buttonText}>Continue</Text>
                  <Text style={styles.buttonIcon}>›</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>

      <Pressable style={styles.skip} onPress={skip}>
        <Text style={styles.skipText}>Skip to next word</Text>
      </Pressable>
    </ScrollView>
  );
}

const difficultyBadge = StyleSheet.create({
  beginner: { backgroundColor: "#dcfce7", color: "#166534" },
  intermediate: { backgroundColor: "#fef9c3", color: "#92400e" },
  advanced: { backgroundColor: "#fee2e2", color: "#991b1b" },
});

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, backgroundColor: "#fff7ed" },
  progressHeader: { gap: 8 },
  header: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#f97316", fontWeight: "700" },
  topProgress: {
    height: 8,
    backgroundColor: "#ffedd5",
    borderRadius: 999,
    overflow: "hidden",
  },
  topProgressFill: { height: "100%", backgroundColor: "#f97316" },
  cardShell: { flex: 1 },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#fed7aa",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 4,
    gap: 16,
  },
  cardBadges: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    textTransform: "capitalize",
    fontWeight: "700",
  },
  categoryBadge: { backgroundColor: "#ffedd5", color: "#9a3412" },
  wordBlock: { alignItems: "center", gap: 10 },
  word: { fontSize: 34, fontWeight: "800", color: "#0f172a" },
  wordProgress: {
    width: "100%",
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  wordProgressFill: { height: "100%", backgroundColor: "#22c55e" },
  wordProgressLabel: { fontSize: 12, color: "#475569" },
  definitionArea: { gap: 10 },
  definitionCard: { backgroundColor: "#fff1e6", borderRadius: 16, padding: 14 },
  definitionLabel: { color: "#c2410c", fontWeight: "700", marginBottom: 4, fontSize: 12 },
  definitionText: { color: "#0f172a", fontSize: 14, lineHeight: 20 },
  exampleCard: { backgroundColor: "#fffbeb", borderRadius: 16, padding: 14 },
  exampleLabel: { color: "#b45309", fontWeight: "700", marginBottom: 4, fontSize: 12 },
  exampleText: { color: "#475569", fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  actions: { gap: 10 },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  knowButton: { backgroundColor: "#22c55e" },
  revealButton: { backgroundColor: "#e2e8f0" },
  continueButton: { backgroundColor: "#f97316" },
  buttonIcon: { color: "white", fontWeight: "800", fontSize: 16 },
  buttonText: { color: "white", fontWeight: "800" },
  revealText: { color: "#0f172a", fontWeight: "800" },
  successCard: {
    backgroundColor: "#22c55e",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  successIcon: { fontSize: 36, color: "white" },
  successTitle: { fontSize: 24, color: "white", fontWeight: "800" },
  successText: { color: "#dcfce7" },
  skip: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  skipText: { color: "#475569", fontWeight: "700" },
});
