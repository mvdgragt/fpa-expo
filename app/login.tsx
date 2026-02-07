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
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);

  const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

  const fetchAndSetClubSessionForUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: staffRow, error: staffError } = await supabase
      .from("club_staff")
      .select("club_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffError) throw staffError;
    if (!staffRow?.club_id) return false;

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id,name,code_4,logo_path")
      .eq("id", staffRow.club_id)
      .single();

    if (clubError) throw clubError;

    await setClubSession({
      type: "club",
      clubCode: String(club.code_4),
      clubId: club.id,
      clubName: club.name,
      clubLogoPath: club.logo_path || undefined,
      loginTime: new Date().toISOString(),
    });

    return true;
  };

  const handleSendCode = async () => {
    const e = normalizeEmail(email);
    if (!e) {
      Alert.alert("Error", "Enter your email");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: e,
      });
      if (error) {
        Alert.alert("Error", error.message || "Could not send code");
        return;
      }
      setStage("otp");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Could not send code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const e = normalizeEmail(email);
    const token = otp.trim();
    if (!e) {
      Alert.alert("Error", "Enter your email");
      return;
    }
    if (!token) {
      Alert.alert("Error", "Enter the code you received");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: e,
        token,
        type: "email",
      });

      if (error || !data.session) {
        Alert.alert("Error", error?.message || "Invalid code");
        return;
      }

      const { data: isAdmin, error: isAdminError } =
        await supabase.rpc("is_admin_user");

      if (isAdminError) {
        Alert.alert("Error", isAdminError.message || "Could not verify role");
        return;
      }

      if (isAdmin) {
        router.replace("/admin" as any);
        return;
      }

      const ok = await fetchAndSetClubSessionForUser();
      if (!ok) {
        Alert.alert(
          "Not allowed",
          "This account is not assigned to a club or admin.",
        );
        await supabase.auth.signOut();
        setStage("phone");
        setOtp("");
        return;
      }

      router.replace("/(tabs)/select-user" as any);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Could not verify code");
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
              <Text style={styles.subtitle}>Sign in with your email</Text>
            </View>

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

              {stage === "otp" ? (
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={24}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Pin code from email"
                    placeholderTextColor="#999"
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    editable={!isLoading}
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={stage === "phone" ? handleSendCode : handleVerifyCode}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <Text style={styles.buttonText}>
                    {stage === "phone" ? "Sending..." : "Verifying..."}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.buttonText}>
                      {stage === "phone" ? "Send code" : "Verify"}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {stage === "phone" ? (
                <TouchableOpacity
                  style={styles.adminLink}
                  onPress={() => router.push("/admin-login" as any)}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.adminLinkText}>Demo login</Text>
                </TouchableOpacity>
              ) : null}

              {stage === "otp" ? (
                <TouchableOpacity
                  style={styles.adminLink}
                  onPress={() => {
                    setStage("phone");
                    setOtp("");
                  }}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.adminLinkText}>Change email</Text>
                </TouchableOpacity>
              ) : null}
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
