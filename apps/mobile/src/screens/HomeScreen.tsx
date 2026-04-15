import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import { collection, getDocs, Timestamp, orderBy, query } from "firebase/firestore";
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

type GameScoreEntry = {
  id: string;
  gameType: string;
  score: number;
  createdAt?: any;
};

type OnboardingSlide = {
  title: string;
  body: string;
};

const { width } = Dimensions.get("window");

function OnboardingModal({
  visible,
  onFinish,
}: {
  visible: boolean;
  onFinish: () => void;
}) {
  const slides: OnboardingSlide[] = [
    {
      title: "Welcome to Word-Nerd 👋",
      body:
        "Word-Nerd is designed to help you actually retain vocabulary over time, not just see words once. You can learn new words, review them consistently, track your progress, and practice with games.",
    },
    {
      title: "Home / Progress",
      body:
        "The Home tab gives you a quick overview of your journey. You can see your stats, overall progress, achievements, daily goal, and top game scores all in one place.",
    },
    {
      title: "Learn",
      body:
        "The Learn tab is where you discover and study new vocabulary. This is the main place to grow your personal word bank.",
    },
    {
      title: "Review",
      body:
        "The Review tab helps you revisit words you have already seen. Reviewing over time is what helps move words into long-term memory.",
    },
    {
      title: "Games",
      body:
        "The Games tab gives you fun ways to practice what you have learned. Use games to strengthen recall, improve speed, and make studying more interactive.",
    },
    {
      title: "Learned",
      body:
        "The Learned tab lets you look back at words you have already worked on. It helps you keep track of your vocabulary progress and revisit familiar words.",
    },
    {
      title: "You’re all set 🎉",
      body:
        "Start learning, keep reviewing, and use games to reinforce your knowledge. Word-Nerd is here to help you build vocabulary that actually sticks.",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
    }
  }, [visible]);

  const currentSlide = slides[currentIndex];
  const isLastSlide = currentIndex === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      onFinish();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.onboardingOverlay}>
        <View style={styles.onboardingCard}>
          <View style={styles.onboardingTopRow}>
            <View style={styles.onboardingDots}>
              {slides.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.onboardingDot,
                    index === currentIndex && styles.onboardingDotActive,
                  ]}
                />
              ))}
            </View>

            {!isLastSlide && (
              <TouchableOpacity onPress={onFinish}>
                <Text style={styles.onboardingSkip}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.onboardingContent}>
            <Text style={styles.onboardingTitle}>{currentSlide.title}</Text>
            <Text style={styles.onboardingBody}>{currentSlide.body}</Text>
          </View>

          <View style={styles.onboardingButtonRow}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={currentIndex === 0}
              style={[
                styles.onboardingSecondaryButton,
                currentIndex === 0 && styles.onboardingDisabledButton,
              ]}
            >
              <Text
                style={[
                  styles.onboardingSecondaryButtonText,
                  currentIndex === 0 && styles.onboardingDisabledButtonText,
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.onboardingPrimaryButton}
            >
              <Text style={styles.onboardingPrimaryButtonText}>
                {isLastSlide ? "Get Started" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen({ onGoLearn }: Props) {
  const user = auth.currentUser;

  const username = useMemo(() => {
    if (!user?.email) return "there";
    const handle = user.email.split("@")[0];
    return handle.length > 0 ? handle : "there";
  }, [user?.email]);

  const [stats, setStats] = useState<HomeStats>({
    wordsSeen: 0,
    wordsMastered: 0,
    inReview: 0,
    dueNow: 0,
    totalWords: 0,
    todaySeen: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [topScores, setTopScores] = useState<GameScoreEntry[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadingOnboarding, setLoadingOnboarding] = useState(true);

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

    const loadTopScores = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingScores(false);
        return;
      }

      try {
        const scoresRef = collection(db, "users", user.uid, "gameScores");
        const q = query(scoresRef, orderBy("score", "desc"));
        const snap = await getDocs(q);

        const wordMatchScores: GameScoreEntry[] = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;

          if (data.gameType === "wordMatching" && wordMatchScores.length < 3) {
            wordMatchScores.push({
              id: docSnap.id,
              gameType: data.gameType,
              score: data.score ?? 0,
              createdAt: data.createdAt,
            });
          }
        });

        setTopScores(wordMatchScores);
      } catch (e) {
        console.log("Failed to load game scores:", e);
      } finally {
        setLoadingScores(false);
      }
    };

    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.log("Failed to load onboarding status:", e);
      } finally {
        setLoadingOnboarding(false);
      }
    };

    loadStats();
    loadTopScores();
    checkOnboarding();
  }, []);

  const handleFinishOnboarding = async () => {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
      setShowOnboarding(false);
    } catch (e) {
      console.log("Failed to save onboarding status:", e);
    }
  };

  const progressPct =
    stats.totalWords > 0
      ? Math.round((stats.wordsMastered / stats.totalWords) * 100)
      : 0;

  const learnedBadge = [
    { label: "First Mastered", earned: stats.wordsMastered >= 1 },
    { label: "5 Mastered", earned: stats.wordsMastered >= 5 },
    { label: "10 Mastered", earned: stats.wordsMastered >= 10 },
  ];

  if (loadingOnboarding) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <>
      <OnboardingModal
        visible={showOnboarding}
        onFinish={handleFinishOnboarding}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.greeting}>Welcome back, {username}! 👋</Text>
          <Text style={styles.subtitle}>Ready to expand your vocabulary today?</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.greenCard]}>
            <Text style={styles.statNumber}>{loadingStats ? "…" : stats.wordsSeen}</Text>
            <Text style={styles.statLabel}>Words Seen 👀</Text>
          </View>

          <View style={[styles.statCard, styles.orangeCard]}>
            <Text style={styles.statNumber}>{loadingStats ? "…" : stats.wordsMastered}</Text>
            <Text style={styles.statLabel}>Words Mastered ✅</Text>
          </View>

          <View style={[styles.statCard, styles.blueCard]}>
            <Text style={styles.statNumber}>{loadingStats ? "…" : stats.inReview}</Text>
            <Text style={styles.statLabel}>In Review 🔁</Text>
          </View>

          <View style={[styles.statCard, styles.purpleCard]}>
            <Text style={styles.statNumber}>{loadingStats ? "…" : stats.dueNow}</Text>
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
            {loadingStats
              ? "Loading progress…"
              : `${stats.wordsMastered} of ${stats.totalWords} words mastered`}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Top Game Scores 🏆</Text>
          </View>

          <View style={styles.gameScoreBubble}>
            <View style={styles.gameScoreHeader}>
              <Text style={styles.gameScoreGameTitle}>Word Match</Text>
              <Text style={styles.gameScoreChip}>Top 3</Text>
            </View>

            {loadingScores ? (
              <ActivityIndicator color="#f97316" />
            ) : topScores.length === 0 ? (
              <Text style={styles.cardText}>
                No scores yet — play a round to set your first high score.
              </Text>
            ) : (
              topScores.map((entry, index) => (
                <View key={entry.id} style={styles.scoreRow}>
                  <View style={styles.scoreRankBadge}>
                    <Text style={styles.scoreRankText}>#{index + 1}</Text>
                  </View>
                  <Text style={styles.scoreValue}>{entry.score}</Text>
                </View>
              ))
            )}
          </View>
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
              : `${stats.todaySeen} / 3 new words seen today`}
          </Text>
          <View style={styles.dailyProgress}>
            <View
              style={[
                styles.dailyFill,
                { width: `${Math.min((stats.todaySeen / 3) * 100, 100)}%` },
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
    backgroundColor: "#fff7ed",
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  gameScoreBubble: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  gameScoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gameScoreGameTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  gameScoreChip: {
    backgroundColor: "#f97316",
    color: "white",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  scoreRankBadge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreRankText: {
    color: "#92400e",
    fontWeight: "800",
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f97316",
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

  onboardingOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  onboardingCard: {
    width: width > 500 ? 420 : "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#ffedd5",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
  },
  onboardingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  onboardingDots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  onboardingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#d1d5db",
  },
  onboardingDotActive: {
    width: 24,
    backgroundColor: "#f97316",
  },
  onboardingSkip: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 14,
  },
  onboardingContent: {
    minHeight: 220,
    justifyContent: "center",
    paddingVertical: 10,
  },
  onboardingTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 14,
  },
  onboardingBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
    textAlign: "center",
  },
  onboardingButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  onboardingPrimaryButton: {
    flex: 1,
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  onboardingPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  onboardingSecondaryButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  onboardingSecondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  onboardingDisabledButton: {
    backgroundColor: "#e5e7eb",
  },
  onboardingDisabledButtonText: {
    color: "#94a3b8",
  },
});