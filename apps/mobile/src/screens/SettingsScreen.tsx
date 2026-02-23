import React from "react";
import { View, Text, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/firebase";

export default function SettingsScreen() {
  const [sending, setSending] = React.useState(false);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error("Logout error:", error);
      showAlert("Error", "Failed to log out. Please try again.");
    }
  };

  const handleChangePassword = async () => {
    if (sending) return;

    try {
      setSending(true);

      const email = auth.currentUser?.email;
      if (!email) {
        showAlert("Error", "No email associated with this account.");
        return;
      }

      await sendPasswordResetEmail(auth, email);

      showAlert(
        "Check your email",
        `We sent a password reset link to:\n${email}\n\nCheck your inbox (and spam) and follow the link.`
      );
    } catch (error: any) {
      console.error("Password reset error:", error);

      if (error?.code === "auth/too-many-requests") {
        showAlert("Too many attempts", "Please wait a few minutes and try again.");
        return;
      }

      showAlert(
        "Reset failed",
        `Code: ${error?.code ?? "unknown"}\n\nMessage: ${error?.message ?? "No message"}`
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <Pressable
        style={[styles.changePasswordButton, sending && styles.disabledButton]}
        onPress={handleChangePassword}
        disabled={sending}
      >
        <Text style={styles.changePasswordText}>
          {sending ? "Sending..." : "Change Password"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 24 },

  logoutButton: { padding: 14, backgroundColor: "#000", borderRadius: 8 },
  logoutText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  changePasswordButton: {
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 8,
    marginTop: 12,
  },
  changePasswordText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  disabledButton: { opacity: 0.6 },
});
