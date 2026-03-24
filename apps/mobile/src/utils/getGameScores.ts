import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

export type GameScoreEntry = {
  id: string;
  gameType: string;
  score: number;
  createdAt?: any;
};

export type TopScoresByGame = Record<string, GameScoreEntry[]>;

export const getTopScoresByGame = async (
  limitPerGame: number = 3
): Promise<TopScoresByGame> => {
  const user = auth.currentUser;

  if (!user) {
    console.log("No user logged in, cannot fetch scores");
    return {};
  }

  try {
    const scoresRef = collection(db, "users", user.uid, "gameScores");
    const q = query(scoresRef, orderBy("score", "desc"));
    const snapshot = await getDocs(q);

    const grouped: TopScoresByGame = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const entry: GameScoreEntry = {
        id: docSnap.id,
        gameType: data.gameType,
        score: data.score,
        createdAt: data.createdAt,
      };

      if (!grouped[entry.gameType]) {
        grouped[entry.gameType] = [];
      }

      if (grouped[entry.gameType].length < limitPerGame) {
        grouped[entry.gameType].push(entry);
      }
    });

    return grouped;
  } catch (error) {
    console.error("Error fetching game scores:", error);
    return {};
  }
};

export const getAllScoresForGame = async (
  gameType: string
): Promise<GameScoreEntry[]> => {
  const user = auth.currentUser;

  if (!user) {
    console.log("No user logged in, cannot fetch scores");
    return [];
  }

  try {
    const scoresRef = collection(db, "users", user.uid, "gameScores");
    const q = query(scoresRef, orderBy("score", "desc"));
    const snapshot = await getDocs(q);

    const scores: GameScoreEntry[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.gameType === gameType) {
        scores.push({
          id: docSnap.id,
          gameType: data.gameType,
          score: data.score,
          createdAt: data.createdAt,
        });
      }
    });

    return scores;
  } catch (error) {
    console.error("Error fetching scores for game:", error);
    return [];
  }
};