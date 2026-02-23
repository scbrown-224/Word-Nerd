import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function GamesScreen() {
  const navigation = useNavigation<any>();

  const games = [
    { title: "Match", desc: "Drag words onto the correct definition." }
  ];

  const onPlay = (title: string) => {
    if (title === "Match") {
      navigation.navigate("MatchGame", {
        poolType: "topic",
        topic: "biology",
        numPairs: 6,
        timeLimitSec: 60,
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Games</Text>
      <Text style={styles.subtitle}>Mini-games to reinforce vocab</Text>

      {games.map((g) => (
        <View key={g.title} style={styles.card}>
          <Text style={styles.cardTitle}>{g.title}</Text>
          <Text style={styles.bodyText}>{g.desc}</Text>
          <Pressable style={styles.primary} onPress={() => onPlay(g.title)}>
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
