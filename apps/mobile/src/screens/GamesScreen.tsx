import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getAllScoresForGame, GameScoreEntry } from "../utils/getGameScores";

type GameTab = "play" | "scores";

export default function GamesScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<GameTab>("play");
  const [matchScores, setMatchScores] = useState<GameScoreEntry[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  const games = [
    { title: "Match", desc: "Drag words onto the correct definition.", accent: "#f97316" },
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

  const loadScores = async () => {
    setLoadingScores(true);
    const scores = await getAllScoresForGame("wordMatching");
    setMatchScores(scores);
    setLoadingScores(false);
  };

  useEffect(() => {
    if (activeTab === "scores") {
      loadScores();
    }
  }, [activeTab]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Games</Text>

      <View style={styles.segmentWrap}>
        <Pressable
          style={[styles.segmentButton, activeTab === "play" && styles.segmentButtonActive]}
          onPress={() => setActiveTab("play")}
        >
          <Text
            style={[styles.segmentText, activeTab === "play" && styles.segmentTextActive]}
          >
            🎮 Play
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentButton, activeTab === "scores" && styles.segmentButtonActive]}
          onPress={() => setActiveTab("scores")}
        >
          <Text
            style={[styles.segmentText, activeTab === "scores" && styles.segmentTextActive]}
          >
            🏆 Scores
          </Text>
        </Pressable>
      </View>

      {activeTab === "play" ? (
        <View style={styles.section}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Pick a challenge</Text>
            <Text style={styles.heroTitle}>Train your vocab with quick, fun games.</Text>
            <Text style={styles.heroBody}>
              Start with Word Match and aim for a new high score.
            </Text>
          </View>

          {games.map((g) => (
            <View key={g.title} style={styles.gameCard}>
              <View style={styles.gameCardTop}>
                <View>
                  <Text style={styles.cardTitle}>{g.title}</Text>
                  <Text style={styles.bodyText}>{g.desc}</Text>
                </View>
                <View style={styles.gameIconBubble}>
                  <Text style={styles.gameIconText}>🎯</Text>
                </View>
              </View>

              <Pressable style={styles.primary} onPress={() => onPlay(g.title)}>
                <Text style={styles.primaryText}>Play Now</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.scoreHero}>
            <Text style={styles.scoreHeroTitle}>Your Best Scores</Text>
            <Text style={styles.scoreHeroBody}>
              Track your top runs and try to beat your best.
            </Text>
          </View>

          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardTitle}>Word Match</Text>
              <Text style={styles.leaderboardChip}>
                {matchScores.length > 0 ? `${matchScores.length} scores` : "No scores yet"}
              </Text>
            </View>

            {loadingScores ? (
              <ActivityIndicator color="#f97316" />
            ) : matchScores.length === 0 ? (
              <Text style={styles.emptyText}>
                No scores saved yet. Play a round to build your leaderboard.
              </Text>
            ) : (
              matchScores.slice(0, 10).map((entry, index) => (
                <View
                  key={entry.id}
                  style={[
                    styles.leaderboardRow,
                    index === 0 && styles.leaderboardRowTop,
                  ]}
                >
                  <View style={styles.rankWrap}>
                    <Text style={[styles.rankText, index === 0 && styles.rankTextTop]}>
                      {index + 1}
                    </Text>
                  </View>

                  <Text style={[styles.leaderboardScore, index === 0 && styles.leaderboardScoreTop]}>
                    {entry.score}
                  </Text>

                  <View style={styles.scoreTag}>
                    <Text style={styles.scoreTagText}>
                      {index === 0 ? "High Score" : "Run"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
    backgroundColor: "#fff7ed",
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    color: "#475569",
  },

  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#ffedd5",
    borderRadius: 18,
    padding: 6,
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#f97316",
  },
  segmentText: {
    fontWeight: "800",
    color: "#9a3412",
  },
  segmentTextActive: {
    color: "white",
  },

  section: {
    gap: 16,
  },

  heroCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffedd5",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3,
    gap: 8,
  },
  heroEyebrow: {
    color: "#f97316",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  heroBody: {
    color: "#475569",
    lineHeight: 20,
  },

  gameCard: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffedd5",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3,
  },
  gameCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  bodyText: {
    color: "#475569",
    maxWidth: "88%",
  },
  gameIconBubble: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
  },
  gameIconText: {
    fontSize: 24,
  },
  primary: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f97316",
    alignItems: "center",
  },
  primaryText: {
    color: "white",
    fontWeight: "800",
  },

  scoreHero: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffedd5",
    gap: 6,
  },
  scoreHeroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  scoreHeroBody: {
    color: "#475569",
  },

  leaderboardCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "white",
  },
  leaderboardChip: {
    backgroundColor: "#facc15",
    color: "#713f12",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
    fontSize: 12,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 16,
    justifyContent: "space-between",
  },
  leaderboardRowTop: {
    backgroundColor: "#facc15",
  },
  rankWrap: {
    width: 34,
    alignItems: "center",
  },
  rankText: {
    fontSize: 18,
    fontWeight: "800",
    color: "white",
  },
  rankTextTop: {
    color: "#713f12",
  },
  leaderboardScore: {
    fontSize: 20,
    fontWeight: "800",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  leaderboardScoreTop: {
    color: "#713f12",
  },
  scoreTag: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scoreTagText: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyText: {
    color: "#cbd5e1",
    lineHeight: 20,
  },
});