// MatchGameScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { collection, getDocs, getDoc, limit, query } from "firebase/firestore";
import { db } from "../firebase/firebase"; // <-- adjust path if needed

type Params = {
  poolType: "topic";
  topic: "biology" | "climate" | "mindset";
  numPairs: number;
  timeLimitSec: number;
};

type Pair = {
  id: string; // wordId
  word: string;
  definition: string;
};

type Box = { x: number; y: number; width: number; height: number };
type ZoneBox = Box & { id: string };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function centerOf(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Animated.ValueXY helper: current = offset + value
function getXY(v: Animated.ValueXY) {
  // @ts-ignore RN internals
  const x = (v.x?._value ?? 0) + (v.x?._offset ?? 0);
  // @ts-ignore RN internals
  const y = (v.y?._value ?? 0) + (v.y?._offset ?? 0);
  return { x, y };
}

export default function MatchGameScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    topic = "biology",
    numPairs = 12,
    timeLimitSec = 60,
    poolType = "topic",
  } = (route.params ?? {}) as Partial<Params>;

  // ---- tuning ----
  const ROUND_SIZE = 3;
  const MATCH_RADIUS_PX = 60; // slightly forgiving so you don't need multiple tries

  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);

  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const [score, setScore] = useState(0);

  const [allPairs, setAllPairs] = useState<Pair[]>([]);
  const [roundPairs, setRoundPairs] = useState<Pair[]>([]);
  const [roundIndex, setRoundIndex] = useState(1);
  const [roundCleared, setRoundCleared] = useState(false);

  // Used to scope responders to a round so old responders can’t reuse wiped positions
  const [roundKey, setRoundKey] = useState(0);

  // State-based matching 
  const [matchedThisRound, setMatchedThisRound] = useState<Record<string, boolean>>({});
  const [filledWordBySlotId, setFilledWordBySlotId] = useState<Record<string, string>>({});

  // Remaining queue
  const queueRef = useRef<Pair[]>([]);

  // Measurements
  const slotZonesRef = useRef<Record<string, ZoneBox>>({});
  const chipHomeRef = useRef<Record<string, Box>>({});

  // Drag state
  const positionsRef = useRef<Record<string, Animated.ValueXY>>({});
  const respondersRef = useRef<Record<string, any>>({});

  const totalCount = allPairs.length;
  const totalMatched = useMemo(() => Object.keys(filledWordBySlotId).length, [filledWordBySlotId]);

  const roundMatchedCount = useMemo(() => {
    return roundPairs.reduce((acc, p) => acc + (matchedThisRound[p.id] ? 1 : 0), 0);
  }, [roundPairs, matchedThisRound]);

  // Timer
  useEffect(() => {
    if (loading || ended) return;
    if (timeLeft <= 0) {
      setEnded(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, ended]);

  const initRoundState = (pairs: Pair[]) => {
    slotZonesRef.current = {};
    chipHomeRef.current = {};
    respondersRef.current = {};
    setRoundKey((k) => k + 1);

    // reset positions
    positionsRef.current = {};
    for (const p of pairs) {
      positionsRef.current[p.id] = new Animated.ValueXY({ x: 0, y: 0 });
    }

    setMatchedThisRound({});
    setRoundCleared(false);
  };

  const endGameFinished = () => {
    setScore((s) => s + Math.max(0, timeLeft));
    setEnded(true);
  };

  const startRound = (pairs: Pair[], newRoundIndex: number) => {
    setRoundPairs(pairs);
    setRoundIndex(newRoundIndex);
    initRoundState(pairs);
  };

  const startNextRoundNow = () => {
    if (ended) return;

    const next = queueRef.current.slice(0, ROUND_SIZE);
    queueRef.current = queueRef.current.slice(next.length);

    if (next.length === 0) {
      endGameFinished();
      return;
    }

    // advance round index with functional update to avoid stale closures
    setRoundIndex((r) => {
      const newIndex = r + 1;
      startRound(next, newIndex);
      return newIndex;
    });
  };

  // Load words (fetch until enough valid pairs)
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setEnded(false);
      setScore(0);
      setTimeLeft(timeLimitSec);

      setAllPairs([]);
      setRoundPairs([]);
      setRoundIndex(1);
      setRoundCleared(false);

      setMatchedThisRound({});
      setFilledWordBySlotId({});
      queueRef.current = [];

      try {
        if (poolType !== "topic") throw new Error("Unsupported poolType (expected 'topic').");

        const desiredCount = Math.max(ROUND_SIZE, Math.min(numPairs, 24));

        const topicWordsCol = collection(db, "topics", topic, "words");
        const qsnap = await getDocs(query(topicWordsCol, limit(180)));
        const wordRefs = shuffle(qsnap.docs.map((d) => d.data()?.wordRef).filter(Boolean));

        const fetched: Pair[] = [];
        const seen = new Set<string>();

        for (const ref of wordRefs) {
          if (fetched.length >= desiredCount) break;

          try {
            const snap = await getDoc(ref);
            if (!snap.exists()) continue;

            const data = snap.data() as any;
            const id = (data.wordId ?? snap.id) as string;
            const word = data.word as string | undefined;
            const definition = data.definition as string | undefined;

            if (!id || !word || !definition) continue;
            if (seen.has(id)) continue;

            seen.add(id);
            fetched.push({ id, word, definition });
          } catch {
            // skip bad refs
          }
        }

        if (!mounted) return;

        const shuffledPairs = shuffle(fetched);
        setAllPairs(shuffledPairs);

        if (shuffledPairs.length < ROUND_SIZE) {
          startRound(shuffledPairs, 1);
          setEnded(true);
          return;
        }

        const first = shuffledPairs.slice(0, ROUND_SIZE);
        const rest = shuffledPairs.slice(ROUND_SIZE);

        queueRef.current = rest;
        startRound(first, 1);
      } catch (e) {
        console.warn(e);
        if (!mounted) return;
        setAllPairs([]);
        setRoundPairs([]);
        setEnded(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [topic, numPairs, timeLimitSec, poolType]);

  useEffect(() => {
    if (loading || ended) return;
    if (roundPairs.length === 0) return;
    if (roundCleared) return;

    const allDone = roundPairs.every((p) => matchedThisRound[p.id]);
    if (allDone) {
      setRoundCleared(true);
      setScore((s) => s + 15);
    }
  }, [matchedThisRound, roundPairs, roundCleared, loading, ended]);

  useEffect(() => {
    if (!roundCleared) return;
    if (ended) return;

    const t = setTimeout(() => {
      startNextRoundNow();
    }, 650);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundCleared, ended]);

  const restart = () =>
    navigation.replace("MatchGame", {
      poolType,
      topic,
      numPairs,
      timeLimitSec,
    });

  /**
   * Drop logic:
   * - find nearest open slot among the 3 definitions
   * - must be within MATCH_RADIUS of that slot CENTER
   * - correct only if nearest slotId === wordId
   */
  const tryDrop = (wordId: string) => {
    const slotIds = roundPairs.map((p) => p.id);

    for (const id of slotIds) {
      if (!slotZonesRef.current[id]) return { status: "not_ready" as const };
    }
    const chipHome = chipHomeRef.current[wordId];
    if (!chipHome) return { status: "not_ready" as const };

    const pos = positionsRef.current[wordId];
    if (!pos) return { status: "not_ready" as const }; // ✅ extra guard

    const { x: dx, y: dy } = getXY(pos);

    const chipNow: Box = {
      x: chipHome.x + dx,
      y: chipHome.y + dy,
      width: chipHome.width,
      height: chipHome.height,
    };
    const chipCenter = centerOf(chipNow);

    let best: { slotId: string; d: number } | null = null;

    for (const id of slotIds) {
      if (matchedThisRound[id]) continue; // filled slot
      const slot = slotZonesRef.current[id];
      const d = dist(chipCenter, centerOf(slot));
      if (!best || d < best.d) best = { slotId: id, d };
    }

    if (!best) return { status: "miss" as const };
    if (best.d > MATCH_RADIUS_PX) return { status: "miss" as const };
    if (best.slotId !== wordId) return { status: "wrong_slot" as const };

    return { status: "ok" as const, slotId: best.slotId };
  };

  const getPanResponder = (wordId: string) => {
    const key = `${roundKey}:${wordId}`;
    if (respondersRef.current[key]) return respondersRef.current[key];

    if (!positionsRef.current[wordId]) {
      positionsRef.current[wordId] = new Animated.ValueXY({ x: 0, y: 0 });
    }
    const pos = positionsRef.current[wordId];

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => !ended && !roundCleared && !matchedThisRound[wordId],
      onMoveShouldSetPanResponder: () => !ended && !roundCleared && !matchedThisRound[wordId],

      onPanResponderGrant: () => {
        pos.stopAnimation();
        const { x, y } = getXY(pos);
        pos.setOffset({ x, y });
        pos.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: () => {
        pos.flattenOffset();

        const res = tryDrop(wordId);

        if (res.status === "ok") {
          const pair = roundPairs.find((p) => p.id === wordId);

          setMatchedThisRound((prev) => ({ ...prev, [wordId]: true }));
          if (pair) setFilledWordBySlotId((prev) => ({ ...prev, [wordId]: pair.word }));

          setScore((s) => s + 10);

          Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          return;
        }

        if (res.status === "not_ready") {
          Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          return;
        }

        setScore((s) => s - 2);
        Animated.spring(pos, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 7,
          tension: 60,
        }).start();
      },
    });

    respondersRef.current[key] = responder;
    return responder;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#475569" }}>Loading words…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hTitle}>Match</Text>
            <Text style={styles.hSub}>
              {topic} • Round {roundIndex} • {totalMatched}/{Math.max(1, totalCount)} matched
            </Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>{timeLeft}s</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Score</Text>
              <Text style={styles.statValue}>{score}</Text>
            </View>
          </View>
        </View>

        {/* Definitions (3) */}
        <View style={styles.defsCard}>
          <Text style={styles.sectionTitle}>Definitions</Text>

          <View style={{ gap: 12 }}>
            {roundPairs.map((p) => {
              const done = !!matchedThisRound[p.id];
              const filled = filledWordBySlotId[p.id] ?? null;

              return (
                <DefZoneWithSlot
                  key={p.id}
                  id={p.id}
                  definition={p.definition}
                  filledWord={filled}
                  done={done}
                  onMeasuredSlot={(box) => (slotZonesRef.current[p.id] = box)}
                />
              );
            })}
          </View>

          <Text style={styles.helperText}>
            {roundMatchedCount}/{ROUND_SIZE} matched — match all {ROUND_SIZE} to unlock the next set.
          </Text>
        </View>

        {/* Words (3) */}
        <View style={styles.tray}>
          <Text style={styles.sectionTitle}>Words</Text>

          <View style={styles.trayRow}>
            {roundPairs.map((p) => {
              // lazy-init so we never pass undefined position
              const pos =
                positionsRef.current[p.id] ??
                (positionsRef.current[p.id] = new Animated.ValueXY({ x: 0, y: 0 }));

              const pan = getPanResponder(p.id);
              const disabled = ended || roundCleared || !!matchedThisRound[p.id];

              return (
                <DraggableChip
                  key={p.id}
                  id={p.id}
                  label={p.word}
                  position={pos}
                  disabled={disabled}
                  panHandlers={pan.panHandlers}
                  onMeasuredHome={(box) => (chipHomeRef.current[p.id] = box)}
                />
              );
            })}
          </View>

          {roundCleared && !ended && (
            <View style={styles.roundBanner}>
              <Text style={styles.roundBannerText}>Round cleared ✅</Text>
            </View>
          )}
        </View>

        {/* End overlay */}
        {ended && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayTitle}>{timeLeft <= 0 ? "Time’s up" : "Finished!"}</Text>
              <Text style={styles.overlayText}>
                Score: <Text style={{ fontWeight: "900" }}>{score}</Text>
              </Text>
              <Text style={styles.overlayText}>
                Matched: {totalMatched}/{Math.max(1, totalCount)}
              </Text>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.secondaryText}>Back</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={restart}>
                  <Text style={styles.primaryBtnText}>Play again</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function DraggableChip({
  label,
  position,
  panHandlers,
  disabled,
  onMeasuredHome,
}: {
  id: string;
  label: string;
  position: Animated.ValueXY;
  panHandlers: any;
  disabled: boolean;
  onMeasuredHome: (box: Box) => void;
}) {
  const ref = useRef<View>(null);

  const measure = () => {
    requestAnimationFrame(() => {
      (ref.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
        onMeasuredHome({ x, y, width, height });
      });
    });
  };

  return (
    <Animated.View
      ref={ref as any}
      onLayout={measure}
      {...(disabled ? {} : panHandlers)}
      style={[
        styles.chip,
        disabled && styles.chipDisabled,
        { transform: position.getTranslateTransform() },
      ]}
    >
      {/* allow wrapping to 2 lines (no ellipses) */}
      <Text style={[styles.chipText, disabled && styles.chipTextDisabled]} numberOfLines={2}>
        {label}
      </Text>
    </Animated.View>
  );
}

function DefZoneWithSlot({
  id,
  definition,
  filledWord,
  done,
  onMeasuredSlot,
}: {
  id: string;
  definition: string;
  filledWord: string | null;
  done: boolean;
  onMeasuredSlot: (box: ZoneBox) => void;
}) {
  const slotRef = useRef<View>(null);

  const measureSlot = () => {
    requestAnimationFrame(() => {
      (slotRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
        onMeasuredSlot({ id, x, y, width, height });
      });
    });
  };

  return (
    <View style={[styles.zoneCard, done && styles.zoneCardDone]}>
      <Text style={styles.zoneText}>{definition}</Text>

      <View
        ref={slotRef as any}
        onLayout={measureSlot}
        style={[styles.dropSlot, done && styles.dropSlotDone]}
      >
        {filledWord ? (
          <Text style={styles.filledWord}>{filledWord}</Text>
        ) : (
          <Text style={styles.dropHint}>Drop word here</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7ed" },

  screen: {
    flex: 1,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
  },

  header: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffedd5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  hSub: { color: "#64748b", marginTop: 2 },

  stats: { flexDirection: "row", gap: 10 },
  statPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    alignItems: "center",
  },
  statLabel: { color: "#9a3412", fontWeight: "800", fontSize: 12 },
  statValue: { color: "#0f172a", fontWeight: "900", marginTop: 2 },

  defsCard: {
    marginTop: 12,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  sectionTitle: { fontWeight: "900", color: "#0f172a", marginBottom: 10 },

  zoneCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    gap: 10,
  },
  zoneCardDone: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  zoneText: { color: "#0f172a", fontWeight: "700" },

  dropSlot: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#fb923c",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  dropSlotDone: {
    borderStyle: "solid",
    borderColor: "#22c55e",
    backgroundColor: "#f0fdf4",
  },

  dropHint: { color: "#94a3b8", fontWeight: "800" },
  filledWord: { color: "#0f172a", fontWeight: "900" },

  helperText: { marginTop: 10, color: "#64748b", fontWeight: "700" },

  tray: {
    marginTop: 12,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },

  trayRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },

  chip: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#f97316",
    borderWidth: 1,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  chipDisabled: { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1" },

  chipText: { color: "white", fontWeight: "900", fontSize: 13, textAlign: "center" },
  chipTextDisabled: { color: "#334155" },

  roundBanner: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    alignItems: "center",
  },
  roundBannerText: { color: "#166534", fontWeight: "900" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  overlayTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  overlayText: { marginTop: 6, color: "#475569", fontWeight: "700" },

  secondaryBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fed7aa",
    alignItems: "center",
    backgroundColor: "#fff7ed",
  },
  secondaryText: { fontWeight: "900", color: "#9a3412" },

  primaryBtn: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: "#f97316", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "900" },
});