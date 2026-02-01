import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

export default function HomeScreen() {
  const user = auth.currentUser;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.text}>Logged in as:</Text>
      <Text style={styles.email}>{user?.email ?? "Unknown"}</Text>

      <Pressable style={styles.button} onPress={() => signOut(auth)}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  text: { fontSize: 16 },
  email: { fontSize: 16, fontWeight: "600" },
  button: { padding: 14, borderRadius: 10, alignItems: "center", backgroundColor: "black", marginTop: 12 },
  buttonText: { color: "white", fontWeight: "600" },
});
