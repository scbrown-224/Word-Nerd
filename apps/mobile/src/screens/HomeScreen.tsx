import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type Props = { onGoLearn?: () => void };

type HomeStats = {
  wordsSeen: number;
  wordsMastered: number;
  inReview: number;
  dueNow: number;
  totalWords: number;
  todaySeen: number;
};

export default function HomeScreen({ onGoLearn }: Props) {
  const user = auth.currentUser;
  const username = useMemo(() => {
    if (!user?.email) return "there";
    const handle = user.email.split("@")[0];
    return handle.length > 0 ? handle : "there";
  }, [user?.email]);

  // Temporary mock progress data to mirror the prototype dashboard layout.
  // replaced mock data below
  const [stats, setStats] = useState<HomeStats>({
    wordsSeen: 0,
    wordsMastered: 0,
    inReview: 0,
    dueNow: 0,
    totalWords: 0,
    todaySeen: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingStats(false);
        return;
      }
  
      try {
        const userWordsCol = collection(db, "users", user.uid, "userWords");
        const snap = await getDocs(userWordsCol);
  
        let wordsSeen = 0;
        let wordsMastered = 0;
        let inReview = 0;
        let dueNow = 0;
        let todaySeen = 0;
  
        const now = new Date();
  
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0
        );
  
        const endOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999
        );
  
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
  
          const seenCount = data.seenCount ?? 0;
          const status = data.status ?? "learning";
          const nextReviewAt = data.nextReviewAt;
  
          if (seenCount > 0) {
            wordsSeen += 1;
          }
  
          if (status === "learned") {
            wordsMastered += 1;
          }
  
          if (seenCount > 0 && status === "learning") {
            inReview += 1;
          }
  
          if (nextReviewAt instanceof Timestamp) {
            const reviewDate = nextReviewAt.toDate();
            if (reviewDate <= now) {
              dueNow += 1;
            }
          }
  
          const firstSeenAt = data.firstSeenAt;
          if (firstSeenAt instanceof Timestamp) {
            const seenDate = firstSeenAt.toDate();
            if (seenDate >= startOfToday && seenDate <= endOfToday) {
              todaySeen += 1;
            }
          }
        });
  
        setStats({
          wordsSeen,
          wordsMastered,
          inReview,
          dueNow,
          totalWords: snap.size,
          todaySeen,
        });
      } catch (e) {
        console.log("Failed to load home stats:", e);
      } finally {
        setLoadingStats(false);
      }
    };
  
    loadStats();
  }, []);

  const progressPct =
  stats.totalWords > 0
    ? Math.round((stats.wordsMastered / stats.totalWords) * 100)
    : 0;

    const learnedBadge = [
      { label: "First Mastered", earned: stats.wordsMastered >= 1 },
      { label: "5 Mastered", earned: stats.wordsMastered >= 5 },
      { label: "10 Mastered", earned: stats.wordsMastered >= 10 },
    ];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.greeting}>Welcome back, {username}! 👋</Text>
        <Text style={styles.subtitle}>Ready to expand your vocabulary today?</Text>
      </View>

      <View style={styles.statsGrid}>
  <View style={[styles.statCard, styles.greenCard]}>
    <Text style={styles.statNumber}>
      {loadingStats ? "…" : stats.wordsSeen}
    </Text>
    <Text style={styles.statLabel}>Words Seen 👀</Text>
  </View>

  <View style={[styles.statCard, styles.orangeCard]}>
    <Text style={styles.statNumber}>
      {loadingStats ? "…" : stats.wordsMastered}
    </Text>
    <Text style={styles.statLabel}>Words Mastered ✅</Text>
  </View>

  <View style={[styles.statCard, styles.blueCard]}>
    <Text style={styles.statNumber}>
      {loadingStats ? "…" : stats.inReview}
    </Text>
    <Text style={styles.statLabel}>In Review 🔁</Text>
  </View>

  <View style={[styles.statCard, styles.purpleCard]}>
    <Text style={styles.statNumber}>
      {loadingStats ? "…" : stats.dueNow}
    </Text>
    <Text style={styles.statLabel}>Due Now ⏰</Text>
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
  {loadingStats ? "Loading progress…" : `${stats.learned} of ${stats.totalWords} words mastered`}
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
        <Text style={styles.cardText}>
  {loadingStats
    ? "Loading today’s progress…"
    : `${stats.todayLearned} / 3 new words seen today`}
</Text>
<View style={styles.dailyProgress}>
  <View
    style={[
      styles.dailyFill,
      { width: `${Math.min((stats.todayLearned / 3) * 100, 100)}%` },
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
