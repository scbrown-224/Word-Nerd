import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCG0DpSQKV0mfsLnvO_JRWlfjmQ-ihVVQE",
    authDomain: "word-nerd-d9f4a.firebaseapp.com",
    projectId: "word-nerd-d9f4a",
    storageBucket: "word-nerd-d9f4a.firebasestorage.app",
    messagingSenderId: "18975164615",
    appId: "1:18975164615:web:e6b2735adb6655f51816e2",
    measurementId: "G-33SLZ5KRZY"
  };

  const app =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
