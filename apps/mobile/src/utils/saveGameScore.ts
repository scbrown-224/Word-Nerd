import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type SaveGameScoreParams = {
  gameType: string;
  score: number;
};

export const saveGameScore = async ({
  gameType,
  score,
}: SaveGameScoreParams) => {
  const user = auth.currentUser;

  if (!user) {
    console.log("No user logged in, score not saved");
    return;
  }

  try {
    await addDoc(collection(db, "users", user.uid, "gameScores"), {
      gameType,
      score,
      createdAt: serverTimestamp(),
    });

    console.log("Game score saved successfully");
  } catch (error) {
    console.error("Error saving game score:", error);
  }
};