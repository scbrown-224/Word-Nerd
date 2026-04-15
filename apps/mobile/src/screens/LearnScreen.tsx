import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { enrollTopicForUser, enrollWordIdsForUser } from "../services/enrollmentService";

type Topic = {
  id: string;
  name: string;
  seeds?: string[];
};

type Word = {
  wordId: string;
  word: string;
  definition: string;
  example: string;
  meanings?: any[];
  audioUrl?: string | null;
  topics?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
};

type CustomSet = {
  id: string;
  name: string;
  wordIds: string[];
  wordCount: number;
};

type UserWordProgress = {
  correctCount: number;
  incorrectCount: number;
  seenCount: number;
  status: "learning" | "learned";
  topics?: string[];
};

type ProgressMap = Record<string, UserWordProgress>;

const FALLBACK_WORD: Word = {
  wordId: "placeholder",
  word: "Pick a source to begin",
  definition: "Choose a topic or a personal set, then start learning.",
  example: "Open Topics or My Sets to build your queue.",
  audioUrl: null,
  meanings: [],
  topics: [],
  difficulty: "beginner",
};

const difficultyBadge = StyleSheet.create({
  beginner: { backgroundColor: "#dcfce7", color: "#166534" },
  intermediate: { backgroundColor: "#fef9c3", color: "#92400e" },
  advanced: { backgroundColor: "#fee2e2", color: "#991b1b" },
});

const normalizeWord = (value: string) => value.trim().toLowerCase();

export default function LearnScreen() {
  const catalogPageSize = 5;
  const [activeTab, setActiveTab] = useState<"learn" | "topics" | "sets">("topics");
  const [setsTab, setSetsTab] = useState<"create" | "browse">("create");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<Topic[]>([]);
  const [customSets, setCustomSets] = useState<CustomSet[]>([]);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [setsLoading, setSetsLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [hasStarted, setHasStarted] = useState(false);
  const [fsWords, setFsWords] = useState<Word[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [setSearchQuery, setSetSearchQuery] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [setWordSearchQuery, setSetWordSearchQuery] = useState("");
  const [catalogPage, setCatalogPage] = useState(0);
  const [draftSetWordIds, setDraftSetWordIds] = useState<Set<string>>(new Set());
  const [savingSet, setSavingSet] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;

      try {
        const topicSnap = await getDocs(collection(db, "topics"));
        const topicList: Topic[] = topicSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data?.name || d.id,
            seeds: data?.seeds || [],
          };
        });
        topicList.sort((a, b) => a.name.localeCompare(b.name));
        setTopics(topicList);
      } catch (e) {
        console.log("Failed to load topics; falling back to defaults", e);
        setTopics([
          { id: "biology", name: "Biology", seeds: ["biology", "cell", "genetics"] },
          { id: "climate", name: "Climate", seeds: ["climate", "carbon", "warming"] },
          { id: "mindset", name: "Mindset", seeds: ["resilience", "focus", "growth"] },
        ]);
      } finally {
        setTopicsLoading(false);
      }

      try {
        const wordSnap = await getDocs(collection(db, "words"));
        const list: Word[] = wordSnap.docs.map((wordDoc) => {
          const data = wordDoc.data() as any;
          return {
            wordId: data.wordId ?? wordDoc.id,
            word: data.word ?? wordDoc.id,
            definition: data.definition ?? "",
            example: data.example ?? "",
            meanings: data.meanings ?? [],
            audioUrl: data.audioUrl ?? null,
            topics: data.topics ?? [],
            difficulty: data.difficulty ?? "beginner",
          };
        });
        list.sort((a, b) => a.word.localeCompare(b.word));
        setAllWords(list);
      } catch (e) {
        console.log("Failed to load word catalog:", e);
      } finally {
        setCatalogLoading(false);
      }

      if (!user) {
        setSetsLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const topicIds: string[] = userSnap.data()?.selectedTopics || [];
          const customSetIds: string[] = userSnap.data()?.selectedCustomSetIds || [];
          const savedSets = (userSnap.data()?.customSets || []) as Array<{
            id: string;
            name: string;
            wordIds?: string[];
          }>;
          setSelectedTopics(new Set(topicIds));
          setSelectedSetIds(new Set(customSetIds));
          setCustomSets(
            savedSets
              .map((setItem) => ({
                id: setItem.id,
                name: setItem.name,
                wordIds: setItem.wordIds || [],
                wordCount: (setItem.wordIds || []).length,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );

          if (topicIds.length || customSetIds.length) {
            setHasStarted(true);
            setActiveTab("learn");
          }
        }
      } catch (e) {
        console.log("Failed to hydrate selected sources", e);
      } finally {
        setSetsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const selectedCustomWords = useMemo(() => {
    const selectedIds = new Set<string>();
    customSets.forEach((setItem) => {
      if (selectedSetIds.has(setItem.id)) {
        setItem.wordIds.forEach((wordId) => selectedIds.add(wordId));
      }
    });
    return selectedIds;
  }, [customSets, selectedSetIds]);

  useEffect(() => {
    const fetchWords = async () => {
      const user = auth.currentUser;
      if (!user || !hasStarted) return;

      if (selectedTopics.size === 0 && selectedCustomWords.size === 0) {
        setFsWords([]);
        setProgressMap({});
        return;
      }

      setLoadingWords(true);

      try {
        const userWordsSnap = await getDocs(collection(db, "users", user.uid, "userWords"));
        const nextProgressMap: ProgressMap = {};
        const chosenWordIds = new Set<string>();

        userWordsSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const docTopics: string[] = data.topics ?? [];
          nextProgressMap[docSnap.id] = {
            correctCount: data.correctCount ?? 0,
            incorrectCount: data.incorrectCount ?? 0,
            seenCount: data.seenCount ?? 0,
            status: data.status ?? "learning",
            topics: docTopics,
          };

          const matchesTopic = docTopics.some((topicId) => selectedTopics.has(topicId));
          const matchesSet = selectedCustomWords.has(docSnap.id);
          if (matchesTopic || matchesSet) {
            chosenWordIds.add(docSnap.id);
          }
        });

        if (chosenWordIds.size === 0) {
          setFsWords([]);
          setProgressMap(nextProgressMap);
          setLoadingWords(false);
          return;
        }

        const selectedWords = allWords.filter((word) => chosenWordIds.has(word.wordId));
        selectedWords.sort((a, b) => a.word.localeCompare(b.word));
        setFsWords(selectedWords);
        setProgressMap(nextProgressMap);
      } catch (e) {
        console.log("Failed to fetch learn words:", e);
        setFsWords([]);
      } finally {
        setLoadingWords(false);
      }
    };

    fetchWords();
  }, [allWords, hasStarted, selectedCustomWords, selectedTopics]);

  const filteredWords = useMemo(() => (fsWords.length ? fsWords : [FALLBACK_WORD]), [fsWords]);
  const totalWords = filteredWords.length || 1;
  const current = useMemo<Word>(
    () => (filteredWords.length ? filteredWords[index % totalWords] : FALLBACK_WORD),
    [filteredWords, index, totalWords]
  );
  const correctCount = progressMap[current.wordId]?.correctCount ?? 0;
  const progressPct = Math.min((correctCount / 3) * 100, 100);
  const primaryTopic = current.topics?.[0] ?? Array.from(selectedTopics)[0] ?? "general";
  const categoryLabel = primaryTopic.charAt(0).toUpperCase() + primaryTopic.slice(1);

  const filteredTopics = useMemo(() => {
    const queryValue = topicSearchQuery.trim().toLowerCase();
    if (!queryValue) return topics;
    return topics.filter(
      (topic) =>
        topic.name.toLowerCase().includes(queryValue) ||
        topic.id.toLowerCase().includes(queryValue) ||
        (topic.seeds || []).some((seed) => seed.toLowerCase().includes(queryValue))
    );
  }, [topicSearchQuery, topics]);

  const filteredCatalogWords = useMemo(() => {
    const queryValue = setWordSearchQuery.trim().toLowerCase();
    if (!queryValue) return allWords;
    return allWords
      .filter(
        (word) =>
          word.word.toLowerCase().includes(queryValue) ||
          word.definition.toLowerCase().includes(queryValue) ||
          (word.topics || []).some((topic) => topic.toLowerCase().includes(queryValue))
      );
  }, [allWords, setWordSearchQuery]);

  const catalogPageCount = Math.max(1, Math.ceil(filteredCatalogWords.length / catalogPageSize));

  const pagedCatalogWords = useMemo(() => {
    const start = catalogPage * catalogPageSize;
    return filteredCatalogWords.slice(start, start + catalogPageSize);
  }, [catalogPage, filteredCatalogWords]);

  const filteredCustomSets = useMemo(() => {
    const queryValue = setSearchQuery.trim().toLowerCase();
    if (!queryValue) return customSets;
    return customSets.filter((setItem) => setItem.name.toLowerCase().includes(queryValue));
  }, [customSets, setSearchQuery]);

  useEffect(() => {
    if (!hasStarted) return;
    if (!current?.wordId || current.wordId === "placeholder") return;

    markWordSeen(current).catch((e) => {
      console.log("Failed to mark word as seen:", e);
    });
  }, [current.wordId, hasStarted]);

  useEffect(() => {
    setCatalogPage(0);
  }, [setWordSearchQuery, setsTab]);

  useEffect(() => {
    if (catalogPage > catalogPageCount - 1) {
      setCatalogPage(Math.max(0, catalogPageCount - 1));
    }
  }, [catalogPage, catalogPageCount]);

  const next = () => {
    setShowDefinition(false);
    setIndex((prev) => (prev + 1) % totalWords);
  };

  const ensureUserDoc = async (uid: string, email?: string | null) => {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        email: email ?? null,
        createdAt: serverTimestamp(),
        selectedTopics: [],
        selectedCustomSetIds: [],
        customSets: [],
        wordsPerDay: 10,
      });
    }

    return userRef;
  };

  const syncUserSources = async (
    uid: string,
    email: string | null | undefined,
    nextTopics: Set<string>,
    nextSetIds: Set<string>
  ) => {
    const userRef = await ensureUserDoc(uid, email);
    await updateDoc(userRef, {
      selectedTopics: Array.from(nextTopics),
      selectedCustomSetIds: Array.from(nextSetIds),
      updatedAt: serverTimestamp(),
    });
  };

  const toggleTopic = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const nextTopics = new Set(selectedTopics);
    const willSelect = !nextTopics.has(id);
    if (willSelect) nextTopics.add(id);
    else nextTopics.delete(id);

    setSelectedTopics(nextTopics);
    setIndex(0);
    setProgressMap({});
    setShowDefinition(false);
    setShowSuccess(false);

    try {
      await syncUserSources(user.uid, user.email, nextTopics, selectedSetIds);
      if (willSelect && hasStarted) {
        await enrollTopicForUser(user.uid, id);
      }
    } catch (e) {
      console.log("Failed to update selected topics:", e);
    }
  };

  const toggleCustomSet = async (setId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const nextSetIds = new Set(selectedSetIds);
    const willSelect = !nextSetIds.has(setId);
    if (willSelect) nextSetIds.add(setId);
    else nextSetIds.delete(setId);

    setSelectedSetIds(nextSetIds);
    setIndex(0);
    setProgressMap({});
    setShowDefinition(false);
    setShowSuccess(false);

    try {
      await syncUserSources(user.uid, user.email, selectedTopics, nextSetIds);
      if (willSelect && hasStarted) {
        const setItem = customSets.find((entry) => entry.id === setId);
        if (setItem) {
          await enrollWordIdsForUser(user.uid, setItem.wordIds, `customSet:${setId}`);
        }
      }
    } catch (e) {
      console.log("Failed to update selected sets:", e);
    }
  };

  const startLearning = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      for (const topicId of selectedTopics) {
        await enrollTopicForUser(user.uid, topicId);
      }

      for (const setId of selectedSetIds) {
        const setItem = customSets.find((entry) => entry.id === setId);
        if (setItem) {
          await enrollWordIdsForUser(user.uid, setItem.wordIds, `customSet:${setId}`);
        }
      }

      setHasStarted(true);
      setActiveTab("learn");
    } catch (e) {
      console.log("Enrollment failed:", e);
    }
  };

  const handleKnow = async () => {
    const user = auth.currentUser;
    if (!user || !current?.wordId || current.wordId === "placeholder") return;

    const userWordRef = doc(db, "users", user.uid, "userWords", current.wordId);
    const currentCorrect = progressMap[current.wordId]?.correctCount ?? 0;
    const currentIncorrect = progressMap[current.wordId]?.incorrectCount ?? 0;
    const currentSeen = progressMap[current.wordId]?.seenCount ?? 0;
    const nextCorrect = currentCorrect + 1;
    const nextStatus = nextCorrect >= 3 ? "learned" : "learning";

    try {
      await updateDoc(userWordRef, {
        correctCount: increment(1),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      setProgressMap((prev) => ({
        ...prev,
        [current.wordId]: {
          correctCount: nextCorrect,
          incorrectCount: currentIncorrect,
          seenCount: currentSeen,
          status: nextStatus,
          topics: prev[current.wordId]?.topics ?? current.topics,
        },
      }));

      if (nextCorrect >= 3) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          next();
        }, 1200);
      } else {
        next();
      }
    } catch (e) {
      console.log("Failed to update word progress:", e);
    }
  };

  const handleDontKnow = async () => {
    const user = auth.currentUser;
    if (!user || !current?.wordId || current.wordId === "placeholder") {
      setShowDefinition(true);
      return;
    }

    const userWordRef = doc(db, "users", user.uid, "userWords", current.wordId);
    const currentCorrect = progressMap[current.wordId]?.correctCount ?? 0;
    const currentIncorrect = progressMap[current.wordId]?.incorrectCount ?? 0;
    const currentSeen = progressMap[current.wordId]?.seenCount ?? 0;

    try {
      await updateDoc(userWordRef, {
        incorrectCount: increment(1),
        status: "learning",
        updatedAt: serverTimestamp(),
      });

      setProgressMap((prev) => ({
        ...prev,
        [current.wordId]: {
          correctCount: currentCorrect,
          incorrectCount: currentIncorrect + 1,
          seenCount: currentSeen,
          status: "learning",
          topics: prev[current.wordId]?.topics ?? current.topics,
        },
      }));
    } catch (e) {
      console.log("Failed to update incorrect count:", e);
    }

    setShowDefinition(true);
  };

  const handleContinue = () => {
    setShowDefinition(false);
    next();
  };

  const skip = () => {
    setShowDefinition(false);
    next();
  };

  const markWordSeen = async (word: Word) => {
    const user = auth.currentUser;
    if (!user || !word?.wordId || word.wordId === "placeholder") return;

    const userWordRef = doc(db, "users", user.uid, "userWords", word.wordId);
    const snap = await getDoc(userWordRef);

    if (!snap.exists()) {
      await setDoc(userWordRef, {
        wordId: word.wordId,
        wordRef: doc(db, "words", word.wordId),
        topics: word.topics ?? [],
        status: "learning",
        seenCount: 1,
        correctCount: 0,
        incorrectCount: 0,
        isFavorite: false,
        isBookmarked: false,
        intervalDays: 1,
        firstSeenAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        lastReviewedAt: null,
        nextReviewAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const data = snap.data() as any;
    await updateDoc(userWordRef, {
      seenCount: increment(1),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(data.firstSeenAt ? {} : { firstSeenAt: serverTimestamp() }),
      ...(data.nextReviewAt ? {} : { nextReviewAt: serverTimestamp() }),
      ...(data.intervalDays ? {} : { intervalDays: 1 }),
    });
  };

  const playCurrentAudio = async () => {
    if (!current?.audioUrl) return;

    try {
      setIsPlayingAudio(true);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: current.audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlayingAudio(false);
        }
      });
      await sound.playAsync();
    } catch (e) {
      console.log("Failed to play audio", e);
      setIsPlayingAudio(false);
    }
  };

  const toggleDraftWord = (wordId: string) => {
    setDraftSetWordIds((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(wordId)) nextSet.delete(wordId);
      else nextSet.add(wordId);
      return nextSet;
    });
  };

  const createCustomSet = async () => {
    const user = auth.currentUser;
    const trimmedName = newSetName.trim();
    if (!user || !trimmedName || draftSetWordIds.size === 0) return;

    setSavingSet(true);
    try {
      const nextSetId = `set_${Date.now()}`;

      const nextSet: CustomSet = {
        id: nextSetId,
        name: trimmedName,
        wordIds: Array.from(draftSetWordIds),
        wordCount: draftSetWordIds.size,
      };

      const nextCustomSets = [...customSets, nextSet].sort((a, b) => a.name.localeCompare(b.name));
      const userRef = await ensureUserDoc(user.uid, user.email);
      await updateDoc(userRef, {
        customSets: nextCustomSets.map((setItem) => ({
          id: setItem.id,
          name: setItem.name,
          wordIds: setItem.wordIds,
        })),
        updatedAt: serverTimestamp(),
      });

      setCustomSets(nextCustomSets);
      const nextSelectedSetIds = new Set(selectedSetIds);
      nextSelectedSetIds.add(nextSet.id);
      setSelectedSetIds(nextSelectedSetIds);
      await syncUserSources(user.uid, user.email, selectedTopics, nextSelectedSetIds);
      if (hasStarted) {
        await enrollWordIdsForUser(user.uid, nextSet.wordIds, `customSet:${nextSet.id}`);
      }

      setNewSetName("");
      setDraftSetWordIds(new Set());
      setSetWordSearchQuery("");
    } catch (e) {
      console.log("Failed to create custom set:", e);
    } finally {
      setSavingSet(false);
    }
  };

  const hasSelection = selectedTopics.size > 0 || selectedSetIds.size > 0;

  const renderLearnTab = () => {
    if (!hasStarted) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set up your queue</Text>
          <Text style={styles.bodyText}>
            Pick one or more topics or personal sets, then press Start learning.
          </Text>
          <View style={styles.inlineActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setActiveTab("topics")}>
              <Text style={styles.secondaryButtonText}>Choose topics</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setActiveTab("sets")}>
              <Text style={styles.secondaryButtonText}>Open my sets</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <>
        <View style={styles.progressHeader}>
          <Text style={styles.header}>Learn</Text>
          <Text style={styles.subtitle}>
            {loadingWords ? "Loading words..." : `${index + 1}/${totalWords}`}
          </Text>
          <View style={styles.topProgress}>
            <View style={[styles.topProgressFill, { width: `${((index + 1) / totalWords) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.activeSourceCard}>
          <Text style={styles.activeSourceTitle}>Current sources</Text>
          <Text style={styles.bodyText}>
            Topics: {selectedTopics.size ? Array.from(selectedTopics).join(", ") : "none"}
          </Text>
          <Text style={styles.bodyText}>
            Personal sets: {selectedSetIds.size ? customSets.filter((setItem) => selectedSetIds.has(setItem.id)).map((setItem) => setItem.name).join(", ") : "none"}
          </Text>
        </View>

        <View style={styles.cardShell}>
          {showSuccess ? (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Word Learned!</Text>
              <Text style={styles.successText}>Great job!</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardBadges}>
                <Text style={[styles.badge, difficultyBadge[current.difficulty ?? "beginner"]]}>
                  {current.difficulty ?? "beginner"}
                </Text>
                <Text style={[styles.badge, styles.categoryBadge]}>{categoryLabel}</Text>
              </View>

              <Pressable style={styles.wordBlock} onPress={playCurrentAudio} disabled={!current.audioUrl}>
                <Text style={styles.word}>
                  {current.word} {current.audioUrl ? (isPlayingAudio ? "🔊" : "▶︎") : ""}
                </Text>
                {correctCount > 0 && (
                  <View style={styles.wordProgress}>
                    <View style={[styles.wordProgressFill, { width: `${progressPct}%` }]} />
                  </View>
                )}
                {correctCount > 0 && (
                  <Text style={styles.wordProgressLabel}>{correctCount} correct</Text>
                )}
              </Pressable>

              {showDefinition && (
                <View style={styles.definitionArea}>
                  <View style={styles.definitionCard}>
                    <Text style={styles.definitionLabel}>Definition</Text>
                    <Text style={styles.definitionText}>{current.definition}</Text>
                  </View>
                  <View style={styles.exampleCard}>
                    <Text style={styles.exampleLabel}>Example</Text>
                    <Text style={styles.exampleText}>"{current.example}"</Text>
                  </View>
                </View>
              )}

              <View style={styles.actions}>
                {!showDefinition ? (
                  <>
                    <Pressable style={[styles.button, styles.knowButton]} onPress={handleKnow}>
                      <Text style={styles.buttonIcon}>✓</Text>
                      <Text style={styles.buttonText}>I Know This Word</Text>
                    </Pressable>
                    <Pressable style={[styles.button, styles.revealButton]} onPress={handleDontKnow}>
                      <Text style={styles.buttonIcon}>?</Text>
                      <Text style={styles.revealText}>Show Definition</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable style={[styles.button, styles.continueButton]} onPress={handleContinue}>
                    <Text style={styles.buttonText}>Continue</Text>
                    <Text style={styles.buttonIcon}>›</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>

        <Pressable style={styles.skip} onPress={skip}>
          <Text style={styles.skipText}>Skip to next word</Text>
        </Pressable>
      </>
    );
  };

  const renderTopicsTab = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pick topics</Text>
      <Text style={styles.bodyText}>
        Choose topic sources for your learning queue. You can mix these with personal sets.
      </Text>

      <TextInput
        placeholder="Search topics..."
        value={topicSearchQuery}
        onChangeText={setTopicSearchQuery}
        style={styles.searchInput}
        placeholderTextColor="#94a3b8"
      />

      <View style={styles.topicGrid}>
        {topicsLoading && <Text style={styles.loading}>Loading topics…</Text>}
        {!topicsLoading &&
          filteredTopics.map((topic) => {
            const active = selectedTopics.has(topic.id);
            return (
              <Pressable
                key={topic.id}
                style={[styles.topicCard, active && styles.topicCardActive]}
                onPress={() => toggleTopic(topic.id)}
              >
                <View style={styles.topicRow}>
                  <View style={[styles.checkbox, active && styles.checkboxChecked]}>
                    {active && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                  <View style={styles.topicContent}>
                    <Text style={[styles.topicName, active && styles.topicNameActive]}>{topic.name}</Text>
                    <Text style={styles.topicSeeds}>{(topic.seeds || []).slice(0, 3).join(", ")}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
      </View>

      <Pressable
        style={[styles.button, hasSelection ? styles.continueButton : styles.disabledButton]}
        onPress={startLearning}
        disabled={!hasSelection}
      >
        <Text style={styles.buttonText}>{hasStarted ? "Refresh learning queue" : "Start learning"}</Text>
        <Text style={styles.buttonIcon}>›</Text>
      </Pressable>
    </View>
  );

  const renderSetsTab = () => (
    <>
      <View style={styles.innerTabRow}>
        <Pressable
          style={[styles.innerTabButton, setsTab === "create" && styles.innerTabButtonActive]}
          onPress={() => setSetsTab("create")}
        >
          <Text style={[styles.innerTabButtonText, setsTab === "create" && styles.innerTabButtonTextActive]}>
            Create Set
          </Text>
        </Pressable>
        <Pressable
          style={[styles.innerTabButton, setsTab === "browse" && styles.innerTabButtonActive]}
          onPress={() => setSetsTab("browse")}
        >
          <Text style={[styles.innerTabButtonText, setsTab === "browse" && styles.innerTabButtonTextActive]}>
            Browse Sets
          </Text>
        </Pressable>
      </View>

      {setsTab === "create" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a personal set</Text>
          <Text style={styles.bodyText}>
            Mix words from different topics into one custom set, then turn that set on for Learn.
          </Text>

          <TextInput
            placeholder="Set name"
            value={newSetName}
            onChangeText={setNewSetName}
            style={styles.searchInput}
            placeholderTextColor="#94a3b8"
          />

          <TextInput
            placeholder="Search words to add..."
            value={setWordSearchQuery}
            onChangeText={setSetWordSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.selectionText}>Selected words: {draftSetWordIds.size}</Text>

          <View style={styles.catalogList}>
            {catalogLoading && <Text style={styles.loading}>Loading words…</Text>}
            {!catalogLoading &&
              pagedCatalogWords.map((word) => {
                const active = draftSetWordIds.has(word.wordId);
                return (
                  <Pressable
                    key={word.wordId}
                    style={[styles.catalogCard, active && styles.catalogCardActive]}
                    onPress={() => toggleDraftWord(word.wordId)}
                  >
                    <Text style={[styles.catalogWord, active && styles.catalogWordActive]}>{word.word}</Text>
                    <Text style={styles.catalogMeta}>
                      {(word.topics || []).join(", ") || "general"}
                    </Text>
                  </Pressable>
                );
              })}
          </View>

          {!catalogLoading && filteredCatalogWords.length > 0 && (
            <View style={styles.pagerRow}>
              <Pressable
                style={[styles.pagerButton, catalogPage === 0 && styles.pagerButtonDisabled]}
                onPress={() => setCatalogPage((prev) => Math.max(0, prev - 1))}
                disabled={catalogPage === 0}
              >
                <Text style={styles.pagerButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.pagerText}>
                {catalogPage + 1} / {catalogPageCount}
              </Text>
              <Pressable
                style={[styles.pagerButton, catalogPage >= catalogPageCount - 1 && styles.pagerButtonDisabled]}
                onPress={() => setCatalogPage((prev) => Math.min(catalogPageCount - 1, prev + 1))}
                disabled={catalogPage >= catalogPageCount - 1}
              >
                <Text style={styles.pagerButtonText}>›</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[
              styles.button,
              newSetName.trim() && draftSetWordIds.size > 0 && !savingSet
                ? styles.continueButton
                : styles.disabledButton,
            ]}
            onPress={createCustomSet}
            disabled={!newSetName.trim() || draftSetWordIds.size === 0 || savingSet}
          >
            <Text style={styles.buttonText}>{savingSet ? "Saving..." : "Create set"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My sets</Text>
          <TextInput
            placeholder="Search sets..."
            value={setSearchQuery}
            onChangeText={setSetSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#94a3b8"
          />

          {setsLoading ? (
            <Text style={styles.loading}>Loading sets…</Text>
          ) : filteredCustomSets.length === 0 ? (
            <Text style={styles.bodyText}>No sets yet. Create one in the other tab.</Text>
          ) : (
            <View style={styles.wordList}>
              {filteredCustomSets.map((setItem) => {
                const active = selectedSetIds.has(setItem.id);
                return (
                  <Pressable
                    key={setItem.id}
                    style={[styles.wordCard, active && styles.wordCardActive]}
                    onPress={() => toggleCustomSet(setItem.id)}
                  >
                    <Text style={styles.wordText}>{setItem.name}</Text>
                    <Text style={styles.definitionText}>{setItem.wordCount} words</Text>
                    <Text style={styles.setStatus}>{active ? "Selected for Learn" : "Tap to add to Learn"}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.progressHeader}>
        <Text style={styles.header}>Learn</Text>
        <Text style={styles.subtitle}>Switch between studying, topics, and your personal sets.</Text>
      </View>

      <View style={styles.tabRow}>
        {[
          { key: "learn", label: "Learn" },
          { key: "topics", label: "Topics" },
          { key: "sets", label: "My Sets" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.key as "learn" | "topics" | "sets")}
          >
            <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "learn" && renderLearnTab()}
      {activeTab === "topics" && renderTopicsTab()}
      {activeTab === "sets" && renderSetsTab()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, backgroundColor: "#fff7ed" },
  progressHeader: { gap: 8 },
  header: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#f97316", fontWeight: "700" },
  bodyText: { color: "#475569", lineHeight: 20 },
  loading: { color: "#64748b" },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#ffedd5",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
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
  innerTabRow: {
    flexDirection: "row",
    backgroundColor: "#fff1e6",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  innerTabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  innerTabButtonActive: {
    backgroundColor: "white",
  },
  innerTabButtonText: {
    color: "#9a3412",
    fontWeight: "700",
  },
  innerTabButtonTextActive: {
    color: "#c2410c",
  },
  topProgress: {
    height: 8,
    backgroundColor: "#ffedd5",
    borderRadius: 999,
    overflow: "hidden",
  },
  topProgressFill: { height: "100%", backgroundColor: "#f97316" },
  activeSourceCard: {
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  activeSourceTitle: { fontSize: 14, fontWeight: "800", color: "#9a3412" },
  cardShell: { flex: 1 },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#fed7aa",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 4,
    gap: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  cardBadges: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    textTransform: "capitalize",
    fontWeight: "700",
  },
  categoryBadge: { backgroundColor: "#ffedd5", color: "#9a3412" },
  wordBlock: { alignItems: "center", gap: 10 },
  word: { fontSize: 34, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  wordProgress: {
    width: "100%",
    height: 8,
    backgroundColor: "#ffedd5",
    borderRadius: 999,
    overflow: "hidden",
  },
  wordProgressFill: { height: "100%", backgroundColor: "#f97316" },
  wordProgressLabel: { color: "#9a3412", fontWeight: "700" },
  definitionArea: { gap: 12 },
  definitionCard: {
    backgroundColor: "#fffaf5",
    borderColor: "#fed7aa",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  definitionLabel: { color: "#c2410c", fontWeight: "800", marginBottom: 4 },
  definitionText: { color: "#334155", lineHeight: 20 },
  exampleCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  exampleLabel: { color: "#c2410c", fontWeight: "800", marginBottom: 4 },
  exampleText: { color: "#475569", fontStyle: "italic", lineHeight: 20 },
  actions: { gap: 10 },
  button: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
  },
  knowButton: { backgroundColor: "#22c55e" },
  revealButton: { backgroundColor: "#e2e8f0" },
  continueButton: { backgroundColor: "#f97316" },
  disabledButton: { backgroundColor: "#cbd5e1" },
  buttonText: { color: "white", fontWeight: "800" },
  revealText: { color: "#0f172a", fontWeight: "800" },
  buttonIcon: { color: "white", fontWeight: "800", fontSize: 18 },
  successCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  successIcon: { fontSize: 44, color: "#16a34a" },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#166534" },
  successText: { color: "#15803d", fontWeight: "700" },
  skip: { alignItems: "center", paddingVertical: 12 },
  skipText: { color: "#9a3412", fontWeight: "700" },
  inlineActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fdba74",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff7ed",
  },
  secondaryButtonText: { color: "#c2410c", fontWeight: "700" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fffaf5",
    color: "#0f172a",
  },
  topicGrid: { gap: 10 },
  topicCard: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fffaf5",
  },
  topicCardActive: {
    backgroundColor: "#ffedd5",
    borderColor: "#f97316",
  },
  topicRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#fdba74",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  checkboxChecked: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  checkboxMark: { color: "white", fontWeight: "900" },
  topicContent: { flex: 1, gap: 4 },
  topicName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  topicNameActive: { color: "#9a3412" },
  topicSeeds: { color: "#64748b" },
  wordList: { gap: 10 },
  wordCard: {
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  wordCardActive: {
    borderColor: "#f97316",
    backgroundColor: "#ffedd5",
  },
  wordText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9a3412",
    textTransform: "capitalize",
  },
  setStatus: { color: "#c2410c", fontWeight: "700", fontSize: 12 },
  selectionText: { color: "#9a3412", fontWeight: "700" },
  catalogList: { gap: 8, maxHeight: 320 },
  catalogCard: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fffaf5",
    gap: 2,
  },
  catalogCardActive: {
    borderColor: "#f97316",
    backgroundColor: "#ffedd5",
  },
  catalogWord: { color: "#0f172a", fontWeight: "800" },
  catalogWordActive: { color: "#9a3412" },
  catalogMeta: { color: "#64748b", fontSize: 12 },
  pagerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  pagerButton: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff1e6",
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  pagerButtonDisabled: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  pagerButtonText: {
    color: "#c2410c",
    fontWeight: "800",
    fontSize: 20,
  },
  pagerText: {
    color: "#9a3412",
    fontWeight: "700",
  },
});
