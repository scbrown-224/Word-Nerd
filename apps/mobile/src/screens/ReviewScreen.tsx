import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function ReviewScreen() {
  // TODO: replace with Firestore query:
  // - fetch words with status learned/learning
  // - spaced repetition scheduling
  const mockDue = [
    { word: "serendipity", status: "due" },
    { word: "meticulous", status: "due" },
    { word: "lucid", status: "upcoming" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Review</Text>
      <Text style={styles.subtitle}>Words due for review (placeholder)</Text>

      <View style={styles.card}>
        {mockDue.map((w) => (
          <View key={w.word} style={styles.row}>
            <Text style={styles.word}>{w.word}</Text>
            <Text style={styles.badge}>{w.status}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next up</Text>
        <Text style={styles.bodyText}>
          Later we’ll show flashcards, quick quizzes, and spaced repetition stats here.
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  word: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  badge: {
    fontSize: 12,
    color: "#9a3412",
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
