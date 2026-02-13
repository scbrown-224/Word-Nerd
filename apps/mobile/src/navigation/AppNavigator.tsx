// AppNavigator.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/firebase";
import LoginScreen from "../screens/LoginScreen";

import HomeScreen from "../screens/HomeScreen";
import LearnScreen from "../screens/LearnScreen";
import ReviewScreen from "../screens/ReviewScreen";
import GamesScreen from "../screens/GamesScreen";
import LearnedScreen from "../screens/LearnedScreen";

import { View, Pressable, Text, StyleSheet } from "react-native";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";


type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

type TabKey = "home" | "learn" | "review" | "games" | "learned";

const Stack = createNativeStackNavigator<RootStackParamList>();

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "learn", label: "Learn", icon: "✦" },
  { key: "review", label: "Review", icon: "↺" },
  { key: "games", label: "Games", icon: "🎮" },
  { key: "learned", label: "Learned", icon: "✓" },
];

function MainTabs() {
  const [active, setActive] = React.useState<TabKey>("home");

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {active === "home" && <HomeScreen onGoLearn={() => setActive("learn")} />}
        {active === "learn" && <LearnScreen />}
        {active === "review" && <ReviewScreen />}
        {active === "games" && <GamesScreen />}
        {active === "learned" && <LearnedScreen />}
      </View>

      <View style={styles.tabBar}>
        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const focused = tab.key === active;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabItem, focused && styles.tabItemActive]}
                onPress={() => setActive(tab.key)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
              >
                <Text style={[styles.tabIcon, focused && styles.tabTextActive]}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, focused && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
  
      if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
  
        if (!snap.exists()) {
          await setDoc(userRef, {
            email: u.email,
            createdAt: serverTimestamp(),
          });
        }
      }
    });
  
    return unsub;
  }, []);
  

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "white",
    borderTopWidth: 2,
    borderTopColor: "#fed7aa", // orange-200-ish
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 10,
    elevation: 10,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  tabItemActive: {
    // mimic “active orange” feel
  },
  tabIcon: { fontSize: 18, color: "#6b7280" }, // gray-500
  tabLabel: { fontSize: 11, color: "#6b7280" },
  tabTextActive: { color: "#ea580c", fontWeight: "800" }, // orange-600
});
