import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";

type WordCard = {
  id: string;
  word: string;
  definition: string;
  example: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
};

const WORDS: WordCard[] = [
  {
    id: "catalyst",
    word: "Catalyst",
    definition: "Something that speeds up a process or causes change without being used up.",
    example: "The new coach served as a catalyst for the team’s turnaround.",
    category: "Science",
    difficulty: "intermediate",
  },
  {
    id: "resilient",
    word: "Resilient",
    definition: "Able to recover quickly after something difficult happens.",
    example: "Children are remarkably resilient after routine setbacks.",
    category: "Mindset",
    difficulty: "beginner",
  },
  {
    id: "feedback",
    word: "Feedback",
    definition: "When an outcome affects the process that caused it (can increase or decrease the change).",
    example: "Positive feedback between ice melt and warming accelerates climate change.",
    category: "Systems",
    difficulty: "intermediate",
  },
  {
    id: "sequester",
    word: "Sequester",
    definition: "To capture and store something, especially carbon, for a long time.",
    example: "Healthy forests sequester large amounts of carbon each year.",
    category: "Environment",
    difficulty: "advanced",
  },
  {
    id: "symbiosis",
    word: "Symbiosis",
    definition: "A close relationship between two different organisms where at least one benefits.",
    example: "Bees and flowering plants share a classic symbiosis.",
    category: "Biology",
    difficulty: "beginner",
  },
];

type ProgressMap = Record<string, { correct: number; status: "learning" | "learned" }>;

export default function LearnScreen() {
  const [index, setIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});

  const current = useMemo(() => WORDS[index], [index]);
  const correctCount = progress[current.id]?.correct ?? 0;
  const progressPct = Math.min((correctCount / 3) * 100, 100);

  const next = () => {
    setShowDefinition(false);
    setIndex((prev) => (prev + 1) % WORDS.length);
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

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.progressHeader}>
        <Text style={styles.header}>Learn</Text>
        <Text style={styles.subtitle}>
          {index + 1}/{WORDS.length}
        </Text>
        <View style={styles.topProgress}>
          <View style={[styles.topProgressFill, { width: `${((index + 1) / WORDS.length) * 100}%` }]} />
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
              <Text style={[styles.badge, styles.categoryBadge]}>{current.category}</Text>
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
});
