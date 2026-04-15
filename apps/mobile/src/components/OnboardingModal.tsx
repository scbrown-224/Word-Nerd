import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";

type OnboardingModalProps = {
  visible: boolean;
  onFinish: () => void;
};

const { width } = Dimensions.get("window");

export default function OnboardingModal({
  visible,
  onFinish,
}: OnboardingModalProps) {
  const slides = useMemo(
    () => [
      {
        title: "Welcome to Word-Nerd",
        body:
          "Word-Nerd helps you actually retain new vocabulary, not just see it once. You can learn words, review them over time, track your progress, and practice with games.",
      },
      {
        title: "Home / Progress",
        body:
          "Your home page gives you a quick snapshot of your learning. You can see your progress, activity, and how you are doing across the app.",
      },
      {
        title: "Learn",
        body:
          "The Learn tab is where you explore and study new words. This is where you build your vocabulary and start adding words to your personal learning journey.",
      },
      {
        title: "Review",
        body:
          "The Review tab helps you revisit words you have already seen. This is important for long-term retention and helps move words from short-term memory into real knowledge.",
      },
      {
        title: "Games",
        body:
          "The Games tab lets you practice in a more interactive way. Play vocabulary games to test your memory, improve recall speed, and make learning more fun.",
      },
      {
        title: "Learned",
        body:
          "The Learned tab shows words you have already worked on. You can look back at your learned vocabulary and keep track of the words you know best.",
      },
      {
        title: "You’re ready!",
        body:
          "Start exploring Word-Nerd and growing your vocabulary. Learn new words, review often, and use games to strengthen your memory.",
      },
    ],
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSlide = slides[currentIndex];
  const isLastSlide = currentIndex === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      onFinish();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.topRow}>
            <View style={styles.progressRow}>
              {slides.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentIndex && styles.activeProgressDot,
                  ]}
                />
              ))}
            </View>

            {!isLastSlide && (
              <TouchableOpacity onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.body}>{currentSlide.body}</Text>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                currentIndex === 0 && styles.disabledButton,
              ]}
              onPress={handleBack}
              disabled={currentIndex === 0}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  currentIndex === 0 && styles.disabledButtonText,
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>
                {isLastSlide ? "Get Started" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: width > 500 ? 420 : "100%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
    marginRight: 12,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D1D5DB",
  },
  activeProgressDot: {
    backgroundColor: "#4F46E5",
    width: 22,
  },
  skipText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  content: {
    paddingVertical: 12,
    minHeight: 220,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
    textAlign: "center",
    paddingHorizontal: 6,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#E5E7EB",
  },
  disabledButtonText: {
    color: "#9CA3AF",
  },
});