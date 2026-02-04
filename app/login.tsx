import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Mock database - Replace with your actual backend API
const CLUBS_DATABASE: Record<string, { clubId: string; clubName: string }> = {
  "john@example.com": { clubId: "club1", clubName: "Elite Fitness Club" },
  "sarah@example.com": { clubId: "club2", clubName: "Power Gym" },
  "mike@example.com": { clubId: "club1", clubName: "Elite Fitness Club" },
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [clubInfo, setClubInfo] = useState<{
    clubId: string;
    clubName: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("");

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call to check email and get club info
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const club = CLUBS_DATABASE[email.toLowerCase()];

      if (!club) {
        Alert.alert(
          "Email Not Found",
          "This email is not associated with any club. Please contact your club administrator.",
        );
        setIsLoading(false);
        return;
      }

      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);

      // In production, send this code via SMS/Email through your backend
      console.log(`Login code for ${email}: ${code}`);

      setClubInfo(club);
      setStep("code");

      // For demo purposes, show the code in an alert
      Alert.alert(
        "Code Sent!",
        `A login code has been sent to your phone.\n\n(Demo code: ${code})`,
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }

    if (code !== generatedCode) {
      Alert.alert("Error", "Invalid verification code. Please try again.");
      return;
    }

    setIsLoading(true);

    try {
      // Save login session
      await AsyncStorage.setItem(
        "userSession",
        JSON.stringify({
          email,
          clubId: clubInfo?.clubId,
          clubName: clubInfo?.clubName,
          loginTime: new Date().toISOString(),
        }),
      );

      // Navigate to select-user screen
      router.replace("/select-user");
    } catch (error) {
      console.error("Error saving session:", error);
      Alert.alert("Error", "Failed to login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
    setClubInfo(null);
    setGeneratedCode("");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo/Header */}
            <View style={styles.header}>
              <Image
                source={require("../assets/images/fpa.png")}
                style={styles.logo}
              />
              <Text style={styles.title}>Future Pro Athletes</Text>
              <Text style={styles.subtitle}>
                {step === "email"
                  ? "Enter your email to get started"
                  : "Enter verification code"}
              </Text>
            </View>

            {step === "email" ? (
              // Email Step
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="mail-outline"
                    size={24}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleEmailSubmit}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <Text style={styles.buttonText}>Checking...</Text>
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Code Step
              <View style={styles.form}>
                {/* Club Info */}
                {clubInfo && (
                  <View style={styles.clubInfoCard}>
                    <Ionicons name="business" size={32} color="#007AFF" />
                    <Text style={styles.clubInfoTitle}>Your Club</Text>
                    <Text style={styles.clubInfoName}>{clubInfo.clubName}</Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={24}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="6-digit code"
                    placeholderTextColor="#999"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleCodeSubmit}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <Text style={styles.buttonText}>Verifying...</Text>
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Login</Text>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBackToEmail}
                  disabled={isLoading}
                >
                  <Ionicons name="arrow-back" size={20} color="#007AFF" />
                  <Text style={styles.backButtonText}>Back to email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleEmailSubmit}
                  disabled={isLoading}
                >
                  <Text style={styles.resendButtonText}>Resend code</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Demo Info */}
            <View style={styles.demoInfo}>
              <Text style={styles.demoInfoTitle}>Demo Accounts:</Text>
              <Text style={styles.demoInfoText}>john@example.com</Text>
              <Text style={styles.demoInfoText}>sarah@example.com</Text>
              <Text style={styles.demoInfoText}>mike@example.com</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
    marginTop: 20,
  },
  logo: {
    width: 110,
    height: 90,
    resizeMode: "contain",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#1a1a1a",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  clubInfoCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  clubInfoTitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 12,
    marginBottom: 4,
  },
  clubInfoName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    textAlign: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 12,
  },
  resendButtonText: {
    color: "#666",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  demoInfo: {
    marginTop: 40,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  demoInfoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
  },
  demoInfoText: {
    fontSize: 14,
    color: "#007AFF",
    marginBottom: 4,
  },
});
