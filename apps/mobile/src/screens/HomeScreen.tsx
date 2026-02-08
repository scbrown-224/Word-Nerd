import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

type Props = { onGoLearn?: () => void };

export default function HomeScreen({ onGoLearn }: Props) {
  const user = auth.currentUser;
  const username = useMemo(() => {
    if (!user?.email) return "there";
    const handle = user.email.split("@")[0];
    return handle.length > 0 ? handle : "there";
  }, [user?.email]);

  // Temporary mock progress data to mirror the prototype dashboard layout.
  const mock = {
    learned: 12,
    learning: 5,
    totalCorrect: 48,
    streak: 5,
    totalWords: 30,
  };

  const progressPct = Math.round((mock.learned / mock.totalWords) * 100);
  const learnedBadge = [
    { label: "First Word", earned: mock.learned >= 1 },
    { label: "5 Words", earned: mock.learned >= 5 },
    { label: "10 Words", earned: mock.learned >= 10 },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.greeting}>Welcome back, {username}! 👋</Text>
        <Text style={styles.subtitle}>Ready to expand your vocabulary today?</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.greenCard]}>
          <Text style={styles.statNumber}>{mock.learned}</Text>
          <Text style={styles.statLabel}>Words Learned</Text>
        </View>
        <View style={[styles.statCard, styles.orangeCard]}>
          <Text style={styles.statNumber}>{mock.streak}</Text>
          <Text style={styles.statLabel}>Day Streak 🔥</Text>
        </View>
        <View style={[styles.statCard, styles.blueCard]}>
          <Text style={styles.statNumber}>{mock.learning}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, styles.purpleCard]}>
          <Text style={styles.statNumber}>{mock.totalCorrect}</Text>
          <Text style={styles.statLabel}>Total Correct</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Overall Progress</Text>
          <Text style={styles.progressValue}>{progressPct}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.cardText}>
          {mock.learned} of {mock.totalWords} words mastered
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Achievements</Text>
        </View>
        <View style={styles.achievements}>
          {learnedBadge.map((badge) => (
            <View
              key={badge.label}
              style={[
                styles.achievementCard,
                badge.earned ? styles.achievementActive : styles.achievementMuted,
              ]}
            >
              <Text style={[styles.achievementIcon, badge.earned && styles.achievementIconActive]}>
                ★
              </Text>
              <Text style={styles.achievementLabel}>{badge.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.dailyCard}>
        <Text style={styles.cardTitle}>Today's Goal 🎯</Text>
        <Text style={styles.cardText}>Learn 3 new words today</Text>
        <View style={styles.dailyProgress}>
          <View
            style={[
              styles.dailyFill,
              { width: `${Math.min((mock.learned / 3) * 100, 100)}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={onGoLearn}>
          <Text style={styles.primaryText}>Go to Learn</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => signOut(auth)}>
          <Text style={styles.secondaryText}>Log out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
    backgroundColor: "#fff7ed",
  },
  headerCard: {
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
  },
  greeting: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  subtitle: { color: "#475569" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "47%",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 4,
  },
  statNumber: { fontSize: 28, color: "white", fontWeight: "800", marginBottom: 4 },
  statLabel: { color: "#f8fafc", opacity: 0.9, fontSize: 12 },
  greenCard: { backgroundColor: "#22c55e" },
  orangeCard: { backgroundColor: "#f97316" },
  blueCard: { backgroundColor: "#3b82f6" },
  purpleCard: { backgroundColor: "#a855f7" },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffedd5",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3,
    gap: 10,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  cardText: { color: "#475569" },
  progressValue: { fontSize: 20, fontWeight: "700", color: "#f97316" },
  progressBar: {
    width: "100%",
    height: 10,
    backgroundColor: "#ffedd5",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#f97316",
  },
  achievements: { flexDirection: "row", gap: 10 },
  achievementCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
  },
  achievementMuted: { backgroundColor: "#e2e8f0" },
  achievementActive: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fbbf24" },
  achievementIcon: { fontSize: 20, color: "#94a3b8", marginBottom: 4 },
  achievementIconActive: { color: "#f97316" },
  achievementLabel: { fontSize: 12, color: "#0f172a", textAlign: "center" },
  dailyCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    padding: 20,
    borderRadius: 22,
  },
  dailyProgress: {
    height: 8,
    backgroundColor: "#fed7aa",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 10,
  },
  dailyFill: { height: "100%", backgroundColor: "#f97316" },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  primary: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#f97316",
    alignItems: "center",
  },
  primaryText: { color: "white", fontWeight: "800" },
  secondary: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fdba74",
    alignItems: "center",
    backgroundColor: "white",
  },
  secondaryText: { color: "#c2410c", fontWeight: "800" },
});
