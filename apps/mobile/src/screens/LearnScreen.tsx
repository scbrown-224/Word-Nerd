import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";

import { words as WORDS, topics as TOPICS, Word } from "../data/mockWords";

import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

const FALLBACK_WORD: Word = {
  id: "placeholder",
  word: "Placeholder",
  definition: "Add words to src/data/mockWords.ts to start practicing.",
  example: "This is where your sample sentences will show up.",
  topics: ["general"],
  difficulty: "beginner",
};

type ProgressMap = Record<string, { correct: number; status: "learning" | "learned" }>;

export default function LearnScreen() {
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});

  const filteredWords = useMemo(
    () =>
      selectedTopics.size === 0
        ? WORDS
        : WORDS.filter((w) => w.topics.some((t) => selectedTopics.has(t))),
    [selectedTopics]
  );

  const totalWords = filteredWords.length || 1;
  const current = useMemo<Word>(
    () => (filteredWords.length ? filteredWords[index % totalWords] : FALLBACK_WORD),
    [filteredWords, index, totalWords]
  );
  const correctCount = progress[current.id]?.correct ?? 0;
  const progressPct = Math.min((correctCount / 3) * 100, 100);
  const primaryTopic = current.topics?.[0] ?? "general";
  const categoryLabel = primaryTopic.charAt(0).toUpperCase() + primaryTopic.slice(1);

  const next = () => {
    setShowDefinition(false);
    setIndex((prev) => (prev + 1) % totalWords);
  };

  const handleKnow = () => {
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

  const handleDontKnow = () => {
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

  const ensureUserDoc = async (uid: string, email?: string | null) => {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
  
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: email ?? null,
        createdAt: serverTimestamp(),
        selectedTopics: [],
        wordsPerDay: 10, // pick your default
      });
    }
  
    return userRef;
  };
  

  const toggleTopic = async (id: string) => {
    // reset local learn state like you already do
    setIndex(0);
    setProgress({});
    setShowDefinition(false);
    setShowSuccess(false);
  
    const user = auth.currentUser;
    if (!user) return; // or route to login
  
    // figure out whether we're selecting or unselecting based on current local state
    const isCurrentlySelected = selectedTopics.has(id);
    const willSelect = !isCurrentlySelected;
  
    try {
      const userRef = await ensureUserDoc(user.uid, user.email);
  
      await updateDoc(userRef, {
        selectedTopics: willSelect ? arrayUnion(id) : arrayRemove(id),
        updatedAt: serverTimestamp(),
      });
  
      // now update local state so UI matches DB
      setSelectedTopics((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch (e) {
      console.log("Failed to update selectedTopics:", e);
      // optional: show a toast/snackbar here
    }
  };
  

  const hasSelection = selectedTopics.size > 0;

  if (!hasSelection) {
    return (
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.progressHeader}>
          <Text style={styles.header}>Pick a topic</Text>
          <Text style={styles.subtitle}>Choose one or more to start learning</Text>
        </View>

        <View style={styles.topicGrid}>
          {TOPICS.map((topic) => {
            const active = selectedTopics.has(topic.id);
            return (
              <Pressable
                key={topic.id}
                style={[styles.topicCard, active && styles.topicCardActive]}
                onPress={() => toggleTopic(topic.id)}
              >
                <Text style={[styles.topicName, active && styles.topicNameActive]}>{topic.name}</Text>
                <Text style={styles.topicSeeds}>{topic.seeds.slice(0, 3).join(", ")}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.button, hasSelection ? styles.continueButton : styles.disabledButton]}
          onPress={() => setSelectedTopics(new Set(selectedTopics))}
          disabled={!hasSelection}
        >
          <Text style={styles.buttonText}>Start learning</Text>
          <Text style={styles.buttonIcon}>›</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.progressHeader}>
        <Text style={styles.header}>Learn</Text>
        <Text style={styles.subtitle}>
          {index + 1}/{totalWords}
        </Text>
        <View style={styles.topProgress}>
          <View style={[styles.topProgressFill, { width: `${((index + 1) / totalWords) * 100}%` }]} />
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
            <View style={styles.cardBadges}>
              <Text style={[styles.badge, difficultyBadge[current.difficulty]]}>{current.difficulty}</Text>
              <Text style={[styles.badge, styles.categoryBadge]}>{categoryLabel}</Text>
            </View>

            <View style={styles.wordBlock}>
              <Text style={styles.word}>{current.word}</Text>
              {correctCount > 0 && (
                <View style={styles.wordProgress}>
                  <View style={[styles.wordProgressFill, { width: `${progressPct}%` }]} />
                </View>
              )}
              {correctCount > 0 && (
                <Text style={styles.wordProgressLabel}>{correctCount} / 3 correct</Text>
              )}
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
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  topicCard: {
    flexBasis: "48%",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  topicCardActive: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },
  topicName: { fontWeight: "800", color: "#0f172a", fontSize: 14 },
  topicNameActive: { color: "#c2410c" },
  topicSeeds: { color: "#475569", fontSize: 12 },
  disabledButton: { backgroundColor: "#cbd5e1" },
});
