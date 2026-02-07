import { Ionicons } from "@expo/vector-icons";
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
import { setClubSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [clubCode, setClubCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleClubCodeLogin = async () => {
    const trimmed = clubCode.trim();
    if (!trimmed) {
      Alert.alert("Error", "Enter your 4-digit club code");
      return;
    }
    if (!/^\d{4}$/.test(trimmed)) {
      Alert.alert("Error", "Club code must be 4 digits");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc("club_login", {
        club_code: trimmed,
      });

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        Alert.alert("Login failed", "Invalid club code");
        return;
      }

      await setClubSession({
        type: "club",
        clubCode: trimmed,
        clubId: row.club_id,
        clubName: row.club_name,
        clubLogoPath: row.club_logo_path || undefined,
        loginTime: new Date().toISOString(),
      });

      router.replace("/select-user");
    } catch (error) {
      console.error("Error logging in:", error);
      Alert.alert("Error", "Failed to login. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
                Enter your club code to continue
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="keypad-outline"
                  size={24}
                  color="#666"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="4-digit club code"
                  placeholderTextColor="#999"
                  value={clubCode}
                  onChangeText={(t) => setClubCode(t.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleClubCodeLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <Text style={styles.buttonText}>Logging in...</Text>
                ) : (
                  <>
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminLink}
                onPress={() => router.push("/admin-login" as any)}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.adminLinkText}>Admin</Text>
              </TouchableOpacity>
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
  adminLink: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 8,
  },
  adminLinkText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
});
