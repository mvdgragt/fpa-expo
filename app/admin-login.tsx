import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
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
import { supabase } from "../lib/supabase";

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const e = email.trim();
    if (!e) {
      Alert.alert("Error", "Enter your email");
      return;
    }
    if (!password) {
      Alert.alert("Error", "Enter your password");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      if (error || !data.user) {
        Alert.alert("Login failed", "Invalid credentials");
        return;
      }

      const { data: adminRow, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError) {
        console.error(adminError);
        Alert.alert("Error", "Failed to verify admin access");
        return;
      }

      if (!adminRow) {
        await supabase.auth.signOut();
        Alert.alert("Not allowed", "This account is not an admin");
        return;
      }

      router.replace("/admin" as any);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={48} color="#111" />
            <Text style={styles.title}>Admin</Text>
            <Text style={styles.subtitle}>
              Sign in to manage clubs and users
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => router.back()}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.backLinkText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", color: "#111", marginTop: 12 },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  form: { maxWidth: 420, alignSelf: "center", width: "100%" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#111" },
  button: {
    marginTop: 8,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backLink: { alignItems: "center", paddingVertical: 14 },
  backLinkText: { color: "#666", fontSize: 14, fontWeight: "600" },
});
