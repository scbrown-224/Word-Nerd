import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/firebase";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import LearnScreen from "../screens/LearnScreen";
import { View, Pressable, Text, StyleSheet } from "react-native";

type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const tabs = [
  { key: "home" as const, label: "Home", icon: "⌂" },
  { key: "learn" as const, label: "Learn", icon: "✦" },
];

function MainTabs() {
  const [active, setActive] = React.useState<"home" | "learn">("home");
  const isHome = active === "home";

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {isHome ? <HomeScreen onGoLearn={() => setActive("learn")} /> : <LearnScreen />}
      </View>
      <View style={styles.tabBar}>
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
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
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
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#e1e1e1",
    backgroundColor: "white",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: "#f2f2f2",
  },
  tabIcon: { fontSize: 18, color: "#666" },
  tabLabel: { fontSize: 12, color: "#666" },
  tabTextActive: { color: "#111", fontWeight: "700" },
});
