import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { getAllScoresForGame, GameScoreEntry } from "../utils/getGameScores";

type GameTab = "play" | "scores";

type HangmanWord = {
  wordId: string;
  word: string;
  definition: string;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_MISSES = 5;

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const normalizeHangmanWord = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z\s-]/g, "")
    .trim();

export default function GamesScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<GameTab>("play");
  const [matchScores, setMatchScores] = useState<GameScoreEntry[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [activeGame, setActiveGame] = useState<"menu" | "hangman">("menu");
  const [hangmanPool, setHangmanPool] = useState<HangmanWord[]>([]);
  const [hangmanCurrent, setHangmanCurrent] = useState<HangmanWord | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [loadingHangman, setLoadingHangman] = useState(false);

  const games = [
    { title: "Match", desc: "Drag words onto the correct definition.", accent: "#f97316", icon: "🎯" },
    { title: "Hangman", desc: "Read the definition and guess the word with 5 misses.", accent: "#0f766e", icon: "🔤" },
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

    if (title === "Hangman") {
      startHangman();
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

  const loadHangmanPool = async () => {
    const user = auth.currentUser;
    if (!user) return [];

    const userWordsSnap = await getDocs(collection(db, "users", user.uid, "userWords"));
    const candidateIds = userWordsSnap.docs
      .filter((docSnap) => {
        const data = docSnap.data() as any;
        return data.status === "learned" || (data.seenCount ?? 0) > 0;
      })
      .map((docSnap) => docSnap.id);

    if (candidateIds.length === 0) {
      return [];
    }

    const fetched: HangmanWord[] = [];
    for (const ids of chunk(candidateIds, 10)) {
      const wordsSnap = await getDocs(query(collection(db, "words"), where(documentId(), "in", ids)));
      wordsSnap.forEach((wordDoc) => {
        const data = wordDoc.data() as any;
        const normalized = normalizeHangmanWord(data.word ?? wordDoc.id);
        if (!normalized || normalized.length < 3) return;

        fetched.push({
          wordId: data.wordId ?? wordDoc.id,
          word: normalized,
          definition: data.definition ?? "",
        });
      });
    }

    return fetched;
  };

  const pickNextHangmanWord = (pool: HangmanWord[]) => {
    if (pool.length === 0) return null;

    const currentId = hangmanCurrent?.wordId;
    const options = pool.filter((word) => word.wordId !== currentId);
    const source = options.length ? options : pool;
    return source[Math.floor(Math.random() * source.length)];
  };

  const startHangman = async () => {
    setActiveGame("hangman");
    setLoadingHangman(true);

    try {
      const pool = hangmanPool.length ? hangmanPool : await loadHangmanPool();
      setHangmanPool(pool);
      setHangmanCurrent(pickNextHangmanWord(pool));
      setGuessedLetters([]);
      setMisses(0);
    } catch (e) {
      console.log("Failed to load hangman words:", e);
      setHangmanCurrent(null);
    } finally {
      setLoadingHangman(false);
    }
  };

  const currentWordLetters = useMemo(() => {
    if (!hangmanCurrent) return [];
    return hangmanCurrent.word.split("");
  }, [hangmanCurrent]);

  const guessedSet = useMemo(() => new Set(guessedLetters), [guessedLetters]);

  const revealedWord = useMemo(() => {
    if (!hangmanCurrent) return [];
    return currentWordLetters.map((char) => {
      if (char === " ") return " ";
      if (char === "-") return "-";
      return guessedSet.has(char) ? char : "_";
    });
  }, [currentWordLetters, guessedSet, hangmanCurrent]);

  const uniqueLetters = useMemo(() => {
    if (!hangmanCurrent) return [];
    return Array.from(new Set(currentWordLetters.filter((char) => /[A-Z]/.test(char))));
  }, [currentWordLetters, hangmanCurrent]);

  const won = uniqueLetters.length > 0 && uniqueLetters.every((char) => guessedSet.has(char));
  const lost = misses >= MAX_MISSES;
  const remainingMisses = Math.max(0, MAX_MISSES - misses);

  const handleGuess = (letter: string) => {
    if (!hangmanCurrent || won || lost || guessedSet.has(letter)) return;

    setGuessedLetters((prev) => [...prev, letter]);
    if (!hangmanCurrent.word.includes(letter)) {
      setMisses((prev) => prev + 1);
    }
  };

  const renderHangman = () => (
    <View style={styles.section}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Definition Hangman</Text>
        <Text style={styles.heroTitle}>Guess the word before you miss 5 times.</Text>
        <Text style={styles.heroBody}>
          Use the clue, tap letters on the keyboard, and fill in the blanks.
        </Text>
      </View>

      <View style={styles.hangmanCard}>
        {loadingHangman ? (
          <ActivityIndicator color="#0f766e" />
        ) : !hangmanCurrent ? (
          <>
            <Text style={styles.hangmanEmptyTitle}>No words ready yet</Text>
            <Text style={styles.emptyText}>
              Learn or review a few words first so Hangman has definitions to use.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.hangmanMetaRow}>
              <Text style={styles.hangmanChip}>Misses left: {remainingMisses}</Text>
              <Text style={styles.hangmanChip}>Guessed: {guessedLetters.length}</Text>
            </View>

            <View style={styles.definitionBubble}>
              <Text style={styles.definitionTitle}>Definition</Text>
              <Text style={styles.definitionBody}>{hangmanCurrent.definition}</Text>
            </View>

            <View style={styles.wordSlots}>
              {revealedWord.map((char, index) => (
                <View
                  key={`${char}-${index}`}
                  style={[styles.slot, char === " " && styles.slotSpacer, char === "-" && styles.slotDash]}
                >
                  <Text style={styles.slotText}>
                    {lost && char === "_" ? currentWordLetters[index] : char}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.statusText}>
              {won
                ? `Correct: ${hangmanCurrent.word}`
                : lost
                  ? `Out of misses. The word was ${hangmanCurrent.word}.`
                  : "Keep guessing letters."}
            </Text>

            <View style={styles.keyboard}>
              {ALPHABET.map((letter) => {
                const used = guessedSet.has(letter);
                const correct = used && hangmanCurrent.word.includes(letter);
                const wrong = used && !hangmanCurrent.word.includes(letter);

                return (
                  <Pressable
                    key={letter}
                    style={[
                      styles.keyButton,
                      correct && styles.keyButtonCorrect,
                      wrong && styles.keyButtonWrong,
                      used && styles.keyButtonUsed,
                    ]}
                    onPress={() => handleGuess(letter)}
                    disabled={used || won || lost}
                  >
                    <Text style={[styles.keyButtonText, used && styles.keyButtonTextUsed]}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.hangmanActions}>
              <Pressable style={styles.secondary} onPress={() => setActiveGame("menu")}>
                <Text style={styles.secondaryText}>Back to games</Text>
              </Pressable>
              <Pressable style={styles.primary} onPress={startHangman}>
                <Text style={styles.primaryText}>{won || lost ? "Play again" : "New word"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Games</Text>

      <View style={styles.segmentWrap}>
        <Pressable
          style={[styles.segmentButton, activeTab === "play" && styles.segmentButtonActive]}
          onPress={() => setActiveTab("play")}
        >
          <Text style={[styles.segmentText, activeTab === "play" && styles.segmentTextActive]}>🎮 Play</Text>
        </Pressable>

        <Pressable
          style={[styles.segmentButton, activeTab === "scores" && styles.segmentButtonActive]}
          onPress={() => setActiveTab("scores")}
        >
          <Text style={[styles.segmentText, activeTab === "scores" && styles.segmentTextActive]}>🏆 Scores</Text>
        </Pressable>
      </View>

      {activeTab === "play" ? (
        activeGame === "hangman" ? (
          renderHangman()
        ) : (
          <View style={styles.section}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Pick a challenge</Text>
              <Text style={styles.heroTitle}>Train your vocab with quick, fun games.</Text>
              <Text style={styles.heroBody}>Switch between matching definitions and spelling from context.</Text>
            </View>

            {games.map((g) => (
              <View key={g.title} style={styles.gameCard}>
                <View style={styles.gameCardTop}>
                  <View>
                    <Text style={styles.cardTitle}>{g.title}</Text>
                    <Text style={styles.bodyText}>{g.desc}</Text>
                  </View>
                  <View style={[styles.gameIconBubble, { backgroundColor: `${g.accent}20` }]}>
                    <Text style={styles.gameIconText}>{g.icon}</Text>
                  </View>
                </View>

                <Pressable style={styles.primary} onPress={() => onPlay(g.title)}>
                  <Text style={styles.primaryText}>Play Now</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )
      ) : (
        <View style={styles.section}>
          <View style={styles.scoreHero}>
            <Text style={styles.scoreHeroTitle}>Your Best Scores</Text>
            <Text style={styles.scoreHeroBody}>Track your top runs and try to beat your best.</Text>
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
              <Text style={styles.emptyText}>No scores saved yet. Play a round to build your leaderboard.</Text>
            ) : (
              matchScores.slice(0, 10).map((entry, index) => (
                <View key={entry.id} style={[styles.leaderboardRow, index === 0 && styles.leaderboardRowTop]}>
                  <View style={styles.rankWrap}>
                    <Text style={[styles.rankText, index === 0 && styles.rankTextTop]}>{index + 1}</Text>
                  </View>

                  <Text style={[styles.leaderboardScore, index === 0 && styles.leaderboardScoreTop]}>
                    {entry.score}
                  </Text>

                  <View style={styles.scoreTag}>
                    <Text style={styles.scoreTagText}>{index === 0 ? "High Score" : "Run"}</Text>
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
  secondary: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    backgroundColor: "white",
  },
  secondaryText: {
    color: "#334155",
    fontWeight: "800",
  },
  hangmanCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ccfbf1",
    gap: 16,
  },
  hangmanMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  hangmanChip: {
    backgroundColor: "#ccfbf1",
    color: "#115e59",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
    fontSize: 12,
  },
  definitionBubble: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  definitionTitle: {
    color: "#0f766e",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  definitionBody: {
    color: "#134e4a",
    lineHeight: 22,
    fontSize: 15,
  },
  wordSlots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  slot: {
    minWidth: 34,
    height: 44,
    borderBottomWidth: 2,
    borderColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  slotSpacer: {
    minWidth: 16,
    borderBottomWidth: 0,
  },
  slotDash: {
    borderBottomWidth: 0,
  },
  slotText: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
  },
  statusText: {
    textAlign: "center",
    color: "#475569",
    fontWeight: "700",
  },
  keyboard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  keyButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  keyButtonUsed: {
    opacity: 0.75,
  },
  keyButtonCorrect: {
    backgroundColor: "#86efac",
  },
  keyButtonWrong: {
    backgroundColor: "#fdba74",
  },
  keyButtonText: {
    color: "#0f172a",
    fontWeight: "800",
  },
  keyButtonTextUsed: {
    color: "#334155",
  },
  hangmanActions: {
    flexDirection: "row",
    gap: 10,
  },
  hangmanEmptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
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
  emptyText: {
    color: "#cbd5e1",
    lineHeight: 20,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leaderboardRowTop: {
    backgroundColor: "#334155",
  },
  rankWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: "#e2e8f0",
    fontWeight: "800",
  },
  rankTextTop: {
    color: "#facc15",
  },
  leaderboardScore: {
    flex: 1,
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  leaderboardScoreTop: {
    color: "#facc15",
  },
  scoreTag: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  scoreTagText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
  },
});
