import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type Word = {
  wordId: string;
  word: string;
  definition: string;
  example: string | null;
  topics?: string[];
};

type Passage = {
  title: string;
  body: string;
  targetWordIds: string[];
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const normalizeToken = (value: string) =>
  value.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");

const pickReaderWords = (words: Word[], variant: number) => {
  if (words.length <= 5) return words;

  const pageSize = 5;
  const start = (variant * pageSize) % words.length;
  const rotated = [...words.slice(start), ...words.slice(0, start)];
  return rotated.slice(0, pageSize);
};

const buildPassage = (words: Word[], variant = 0): Passage | null => {
  if (!words.length) return null;

  const chosenWords = pickReaderWords(words, variant);
  const topic = chosenWords[0]?.topics?.[0] ?? "everyday learning";
  const opening = `Today's reader follows a short ${topic} scene. Read closely and tap any underlined word if you want a quick reminder before moving on.`;
  const detailSentences = chosenWords.map((word, index) => {
    const cleanedSource = word.example?.trim()
      ? word.example
      : `${word.word} appears naturally in this short reading passage.`;
    const cleaned = cleanedSource.endsWith(".") ? cleanedSource : `${cleanedSource}.`;

    if (index === 0) {
      return `At the start, ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
    }

    if (index === chosenWords.length - 1) {
      return `By the end, ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
    }

    return `Later, ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  });

  return {
    title: `${topic.charAt(0).toUpperCase()}${topic.slice(1)} Reader`,
    body: [opening, ...detailSentences].join(" "),
    targetWordIds: chosenWords.map((word) => word.wordId),
  };
};

export default function LearnedScreen() {
  const [learnedWords, setLearnedWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [activeTab, setActiveTab] = useState<"words" | "reader">("words");
  const [passageVariant, setPassageVariant] = useState(0);

  useEffect(() => {
    const fetchLearnedWords = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLearnedWords([]);
        setLoading(false);
        return;
      }

      try {
        const userWordsCol = collection(db, "users", user.uid, "userWords");
        const userWordsSnap = await getDocs(userWordsCol);

        const learnedWordIds = userWordsSnap.docs
          .filter((docSnap) => {
            const data = docSnap.data() as any;
            return data.status === "learned" || (data.correctCount ?? 0) >= 3;
          })
          .map((docSnap) => docSnap.id);

        if (learnedWordIds.length === 0) {
          setLearnedWords([]);
          setLoading(false);
          return;
        }

        const fetched: Word[] = [];
        const idChunks = chunk(learnedWordIds, 10);

        for (const ids of idChunks) {
          const wordsCol = collection(db, "words");
          const qWords = query(wordsCol, where(documentId(), "in", ids));
          const wordsSnap = await getDocs(qWords);

          wordsSnap.forEach((wordDoc) => {
            const data = wordDoc.data() as any;
            fetched.push({
              wordId: data.wordId ?? wordDoc.id,
              word: data.word ?? wordDoc.id,
              definition: data.definition ?? "",
              example: data.example ?? null,
              topics: data.topics ?? [],
            });
          });
        }

        fetched.sort((a, b) => a.word.localeCompare(b.word));
        setLearnedWords(fetched);
        setPassage(buildPassage(fetched, 0));
      } catch (e) {
        console.log("Failed to load learned words:", e);
        setLearnedWords([]);
        setPassage(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLearnedWords();
  }, []);

  const passageWords = useMemo(() => {
    if (!passage) return [];
    const targetIds = new Set(passage.targetWordIds);
    return learnedWords.filter((word) => targetIds.has(word.wordId));
  }, [learnedWords, passage]);

  const targetWordMap = useMemo(() => {
    const map = new Map<string, Word>();
    passageWords.forEach((word) => {
      map.set(normalizeToken(word.word), word);
    });
    return map;
  }, [passageWords]);

  const renderPassage = () => {
    if (!passage) return null;

    const tokens = passage.body.split(/(\s+)/);
    return (
      <Text style={styles.readerText}>
        {tokens.map((token, index) => {
          if (/^\s+$/.test(token)) {
            return token;
          }

          const matchedWord = targetWordMap.get(normalizeToken(token));
          if (!matchedWord) {
            return (
              <Text key={`${token}-${index}`} style={styles.readerText}>
                {token}
              </Text>
            );
          }

          return (
            <Text
              key={`${matchedWord.wordId}-${index}`}
              style={styles.readerWord}
              onPress={() => setSelectedWord(matchedWord)}
            >
              {token}
            </Text>
          );
        })}
      </Text>
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Learned</Text>
        <Text style={styles.subtitle}>
          Words you have already learned well enough to use in context
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === "words" && styles.tabButtonActive]}
            onPress={() => setActiveTab("words")}
          >
            <Text style={[styles.tabButtonText, activeTab === "words" && styles.tabButtonTextActive]}>
              Learned Words
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "reader" && styles.tabButtonActive]}
            onPress={() => setActiveTab("reader")}
          >
            <Text style={[styles.tabButtonText, activeTab === "reader" && styles.tabButtonTextActive]}>
              Reader
            </Text>
          </Pressable>
        </View>

        {activeTab === "reader" ? (
          <View style={styles.card}>
            <View style={styles.readerHeader}>
              <View style={styles.readerHeaderText}>
                <Text style={styles.cardTitle}>Reader</Text>
                <Text style={styles.bodyText}>
                  Build a short passage from your learned vocabulary, then tap an underlined word for a quick definition check.
                </Text>
              </View>
              <Pressable
                style={[styles.readerButton, learnedWords.length === 0 && styles.readerButtonDisabled]}
                onPress={() => {
                  const nextVariant = passageVariant + 1;
                  setPassageVariant(nextVariant);
                  setPassage(buildPassage(learnedWords, nextVariant));
                }}
                disabled={learnedWords.length === 0}
              >
                <Text style={styles.readerButtonText}>New passage</Text>
              </Pressable>
            </View>

            {loading ? (
              <Text style={styles.bodyText}>Loading words…</Text>
            ) : learnedWords.length === 0 ? (
              <Text style={styles.bodyText}>
                No learned words yet. Reach the learned state in Learn or Review, then come back here.
              </Text>
            ) : !passage ? (
              <Text style={styles.bodyText}>
                Tap the button to generate a short reading passage from your learned words.
              </Text>
            ) : (
              <View style={styles.readerCard}>
                <Text style={styles.readerTitle}>{passage.title}</Text>
                {renderPassage()}
                <View style={styles.readerFooter}>
                  <Text style={styles.readerHint}>Underlined words open a definition card.</Text>
                  <Text style={styles.readerHint}>
                    Target words: {passageWords.map((word) => word.word).join(", ")}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your learned words</Text>

            {loading ? (
              <Text style={styles.bodyText}>Loading words…</Text>
            ) : learnedWords.length === 0 ? (
              <Text style={styles.bodyText}>
                No words yet. Go through a few words on the Learn tab first.
              </Text>
            ) : (
              <View style={styles.wordList}>
                {learnedWords.map((word) => (
                  <Pressable
                    key={word.wordId}
                    style={styles.wordCard}
                    onPress={() => setSelectedWord(word)}
                  >
                    <Text style={styles.wordText}>{word.word}</Text>
                    {!!word.definition && (
                      <Text style={styles.definitionText}>{word.definition}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats</Text>
          <Text style={styles.bodyText}>
            Total learned words: {learnedWords.length}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedWord}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedWord(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedWord(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalWord}>{selectedWord?.word}</Text>
            {!!selectedWord?.definition && (
              <>
                <Text style={styles.modalLabel}>Definition</Text>
                <Text style={styles.modalBody}>{selectedWord.definition}</Text>
              </>
            )}
            {!!selectedWord?.example && (
              <>
                <Text style={styles.modalLabel}>Example</Text>
                <Text style={styles.modalBody}>{selectedWord.example}</Text>
              </>
            )}
            <Pressable style={styles.modalButton} onPress={() => setSelectedWord(null)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  bodyText: { color: "#475569", lineHeight: 20 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#ffedd5",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "white",
  },
  tabButtonText: {
    color: "#9a3412",
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#c2410c",
  },
  readerHeader: { gap: 12 },
  readerHeaderText: { gap: 6 },
  readerButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ea580c",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  readerButtonDisabled: { backgroundColor: "#cbd5e1" },
  readerButtonText: { color: "white", fontWeight: "800" },
  readerCard: {
    backgroundColor: "#fffaf5",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fed7aa",
    gap: 12,
  },
  readerTitle: { fontSize: 18, fontWeight: "800", color: "#9a3412" },
  readerText: { color: "#334155", fontSize: 16, lineHeight: 28 },
  readerWord: {
    color: "#c2410c",
    textDecorationLine: "underline",
    fontWeight: "700",
  },
  readerFooter: { gap: 4 },
  readerHint: { color: "#78716c", fontSize: 12, lineHeight: 18 },
  wordList: { gap: 10 },
  wordCard: {
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  wordText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9a3412",
    textTransform: "capitalize",
  },
  definitionText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  modalWord: { fontSize: 22, fontWeight: "800", color: "#9a3412" },
  modalLabel: { fontSize: 12, fontWeight: "800", color: "#c2410c", textTransform: "uppercase" },
  modalBody: { color: "#334155", lineHeight: 22 },
  modalButton: {
    marginTop: 6,
    backgroundColor: "#ea580c",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalButtonText: { color: "white", fontWeight: "800" },
});
