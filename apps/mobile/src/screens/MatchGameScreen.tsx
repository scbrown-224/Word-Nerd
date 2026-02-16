// MatchGameScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  PanResponder,
} from "react-native";
import { collection, getDocs, limit, query, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase"; // adjust import to your project

type Params = {
  poolType: "topic";
  topic: "biology" | "climate" | "mindset";
  numPairs: number;
  timeLimitSec: number;
};

type WordDoc = {
  wordId: string;
  word: string;
  definition: string;
  example?: string | null;
};

type Pair = {
  id: string; // wordId
  word: string;
  definition: string;
};

type DropZone = {
  id: string; // pair id
  x: number;
  y: number;
  width: number;
  height: number;
};

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function MatchGameScreen({ route, navigation }: any) {
  const { topic, numPairs, timeLimitSec } = route.params as Params;

  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [wordOrder, setWordOrder] = useState<Pair[]>([]);
  const [defOrder, setDefOrder] = useState<Pair[]>([]);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const [ended, setEnded] = useState(false);

  // Drop zones measured from UI
  const dropZonesRef = useRef<Record<string, DropZone>>({});

  // Animated positions per draggable word
  const positionsRef = useRef<Record<string, Animated.ValueXY>>({});
  const homeRef = useRef<Record<string, { x: number; y: number }>>({}); // where to snap back

  const allMatched = useMemo(() => {
    if (!pairs.length) return false;
    return pairs.every((p) => matched[p.id]);
  }, [pairs, matched]);

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

  // End conditions
  useEffect(() => {
    if (loading || ended) return;
    if (allMatched) {
      // bonus: remaining seconds
      setScore((s) => s + timeLeft);
      setEnded(true);
    }
  }, [allMatched, timeLeft, loading, ended]);

  // Fetch words for topic
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setEnded(false);
      setScore(0);
      setTimeLeft(timeLimitSec);
      setMatched({});
      dropZonesRef.current = {};
      positionsRef.current = {};
      homeRef.current = {};

      try {
        // /topics/{topic}/words/{wordId} contains { wordRef }
        const topicWordsCol = collection(db, "topics", topic, "words");
        const qsnap = await getDocs(query(topicWordsCol, limit(50)));

        const wordRefs = qsnap.docs
          .map((d) => d.data()?.wordRef)
          .filter(Boolean);

        // Fetch word docs (first N after shuffle)
        const pickedRefs = shuffle(wordRefs).slice(0, clamp(numPairs, 2, 12));

        const fetched: WordDoc[] = [];
        for (const ref of pickedRefs) {
          // wordRef is a DocumentReference to /words/{wordId}
          const snap = await getDoc(ref);
          if (!snap.exists()) continue;
          const data = snap.data() as any;
          if (!data?.word || !data?.definition) continue;
          fetched.push({
            wordId: data.wordId ?? snap.id,
            word: data.word,
            definition: data.definition,
            example: data.example ?? null,
          });
        }

        const builtPairs: Pair[] = fetched.map((w) => ({
          id: w.wordId,
          word: w.word,
          definition: w.definition,
        }));

        if (!mounted) return;

        setPairs(builtPairs);
        setWordOrder(shuffle(builtPairs));
        setDefOrder(shuffle(builtPairs));

        // init animated values
        for (const p of builtPairs) {
          positionsRef.current[p.id] = new Animated.ValueXY({ x: 0, y: 0 });
        }
      } catch (e) {
        console.warn(e);
        if (!mounted) return;
        setPairs([]);
        setWordOrder([]);
        setDefOrder([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [topic, numPairs, timeLimitSec]);

  const restart = () => {
    // simplest: re-navigate to same route with same params
    navigation.replace("MatchGame", route.params);
  };

  const tryDrop = (pairId: string) => {
    const pos = positionsRef.current[pairId];
    const zones = dropZonesRef.current;

    // We treat the dragged "chip" position as relative translation.
    // We’ll approximate hit-testing by using current translation and comparing
    // to zone boxes in the same screen space (good enough for a fun game).
    const dx = (pos as any).__getValue().x as number;
    const dy = (pos as any).__getValue().y as number;

    // Find nearest zone by overlap test
    // (We’ll just check if chip center landed inside zone)
    // We don't have chip absolute coords, so we store "home" positions as screen coords.
    const home = homeRef.current[pairId];
    if (!home) return { ok: false as const };

    const chipCenterX = home.x + dx + 60; // ~half chip width
    const chipCenterY = home.y + dy + 18; // ~half chip height

    let hit: DropZone | null = null;
    for (const z of Object.values(zones)) {
      const inside =
        chipCenterX >= z.x &&
        chipCenterX <= z.x + z.width &&
        chipCenterY >= z.y &&
        chipCenterY <= z.y + z.height;
      if (inside) {
        hit = z;
        break;
      }
    }

    if (!hit) return { ok: false as const };

    const correct = hit.id === pairId;
    return { ok: correct as const, zoneId: hit.id };
  };

  const makePanResponder = (pairId: string) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !ended && !matched[pairId],
      onPanResponderMove: Animated.event([null, { dx: positionsRef.current[pairId].x, dy: positionsRef.current[pairId].y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        const res = tryDrop(pairId);

        if (res.ok) {
          setMatched((m) => ({ ...m, [pairId]: true }));
          setScore((s) => s + 10);

          // snap chip toward the zone (simple: animate to 0,0 then hide it via matched state)
          Animated.spring(positionsRef.current[pairId], {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        } else {
          setScore((s) => s - 2);
          Animated.spring(positionsRef.current[pairId], {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    });

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#475569" }}>Loading words…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.hTitle}>Match</Text>
          <Text style={styles.hSub}>{topic} • {pairs.length} pairs</Text>
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

      {/* Board */}
      <View style={styles.board}>
        {/* Left: draggable words */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>Words</Text>

          {wordOrder.map((p) => {
            const pan = makePanResponder(p.id);
            const pos = positionsRef.current[p.id];
            const isDone = !!matched[p.id];

            return (
              <View
                key={p.id}
                onLayout={(e) => {
                  // store absolute position approximation via measureInWindow
                  // NOTE: we need measureInWindow; easiest is ref + measure.
                }}
                style={{ marginBottom: 12 }}
              >
                {!isDone ? (
                  <DraggableChip
                    id={p.id}
                    label={p.word}
                    position={pos}
                    panHandlers={pan.panHandlers}
                    onMeasuredHome={(home) => (homeRef.current[p.id] = home)}
                  />
                ) : (
                  <View style={[styles.chip, styles.chipDone]}>
                    <Text style={styles.chipTextDone}>{p.word}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Right: drop zones */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>Definitions</Text>

          {defOrder.map((p) => {
            const isTaken = !!matched[p.id];

            return (
              <View
                key={p.id}
                style={[styles.zone, isTaken && styles.zoneDone]}
                onLayout={(e) => {
                  // capture box in window coords
                  // Using measureInWindow via ref is more reliable than layout x/y.
                }}
              >
                <DropZoneCard
                  id={p.id}
                  text={p.definition}
                  disabled={isTaken}
                  onMeasured={(box) => (dropZonesRef.current[p.id] = box)}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* End overlay */}
      {ended && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>{allMatched ? "Nice!" : "Time’s up"}</Text>
            <Text style={styles.overlayText}>Score: <Text style={{ fontWeight: "900" }}>{score}</Text></Text>
            <Text style={styles.overlayText}>
              Matched: {Object.keys(matched).length}/{pairs.length}
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
  );
}

/** Draggable chip that measures its “home” location in window coords */
function DraggableChip({
  id,
  label,
  position,
  panHandlers,
  onMeasuredHome,
}: {
  id: string;
  label: string;
  position: Animated.ValueXY;
  panHandlers: any;
  onMeasuredHome: (home: { x: number; y: number }) => void;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    // measure after mount
    const t = setTimeout(() => {
      (ref.current as any)?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
        onMeasuredHome({ x, y });
      });
    }, 50);
    return () => clearTimeout(t);
  }, [onMeasuredHome]);

  return (
    <Animated.View
      ref={ref as any}
      {...panHandlers}
      style={[
        styles.chip,
        {
          transform: position.getTranslateTransform(),
        },
      ]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Animated.View>
  );
}

/** Drop zone card that measures itself in window coords */
function DropZoneCard({
  id,
  text,
  disabled,
  onMeasured,
}: {
  id: string;
  text: string;
  disabled: boolean;
  onMeasured: (box: { id: string; x: number; y: number; width: number; height: number }) => void;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      (ref.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
        onMeasured({ id, x, y, width, height });
      });
    }, 50);
    return () => clearTimeout(t);
  }, [id, onMeasured]);

  return (
    <View ref={ref as any} style={{ opacity: disabled ? 0.6 : 1 }}>
      <Text style={styles.zoneText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff7ed", padding: 16 },
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

  board: { flex: 1, flexDirection: "row", gap: 14, marginTop: 14 },
  col: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  colTitle: { fontWeight: "900", color: "#0f172a", marginBottom: 10 },

  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f97316",
    borderWidth: 1,
    borderColor: "#f97316",
  },
  chipText: { color: "white", fontWeight: "900" },
  chipDone: { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1" },
  chipTextDone: { color: "#334155", fontWeight: "900" },

  zone: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    marginBottom: 12,
    minHeight: 64,
    justifyContent: "center",
  },
  zoneDone: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  zoneText: { color: "#0f172a", fontWeight: "700" },

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
