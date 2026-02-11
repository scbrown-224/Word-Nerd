import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function LearnedScreen() {
  // TODO: replace with Firestore query:
  // - words where status === "learned"
  // - include learnedDate, correct/incorrect counts
  const learned = ["serene", "candid", "resilient", "vivid", "keen"];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Learned</Text>
      <Text style={styles.subtitle}>Your mastered words (placeholder)</Text>

      <View style={styles.card}>
        <View style={styles.pillRow}>
          {learned.map((w) => (
            <View key={w} style={styles.pill}>
              <Text style={styles.pillText}>{w}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stats</Text>
        <Text style={styles.bodyText}>
          Later: total learned, streak impact, review accuracy, and dates.
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pill: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { fontWeight: "700", color: "#9a3412" },
});
