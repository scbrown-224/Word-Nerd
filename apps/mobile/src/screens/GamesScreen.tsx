import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";

export default function GamesScreen() {
  // TODO: hook into learned/learning words for game pools
  const games = [
    { title: "Match", desc: "Match words to definitions (placeholder)" },
    { title: "Speed Round", desc: "Quick multiple choice (placeholder)" },
    { title: "Spelling", desc: "Type the word you hear/see (placeholder)" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Games</Text>
      <Text style={styles.subtitle}>Mini-games to reinforce vocab</Text>

      {games.map((g) => (
        <View key={g.title} style={styles.card}>
          <Text style={styles.cardTitle}>{g.title}</Text>
          <Text style={styles.bodyText}>{g.desc}</Text>
          <Pressable style={styles.primary} onPress={() => {}}>
            <Text style={styles.primaryText}>Play</Text>
          </Pressable>
        </View>
      ))}
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
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  bodyText: { color: "#475569" },
  primary: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f97316",
    alignItems: "center",
  },
  primaryText: { color: "white", fontWeight: "800" },
});
