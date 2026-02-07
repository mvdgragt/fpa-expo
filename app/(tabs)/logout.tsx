import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearClubSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";

export default function LogoutScreen() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await clearClubSession();

      let isDemo = false;
      try {
        const { data, error } = await supabase.rpc("is_demo_account");
        if (error) throw error;
        isDemo = !!data;
      } catch (e) {
        if (__DEV__) console.error("[Demo] is_demo_account failed", e);
      }

      if (!isDemo) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.email?.toLowerCase() === "demo@fpa.se") {
            isDemo = true;
          }
        } catch {
          // ignore
        }
      }

      if (isDemo) {
        const { error: resetError } = await supabase.rpc("reset_demo_data");
        if (resetError) {
          if (__DEV__)
            console.error("[Demo] reset_demo_data failed", resetError);
          Alert.alert(
            "Demo reset failed",
            resetError.message || "Could not reset demo data",
          );
        }
      } else {
        if (__DEV__) console.log("[Demo] not detected");
      }

      await supabase.auth.signOut();
      router.replace("/login" as any);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Could not log out");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Logout</Text>
        <Text style={styles.subtitle}>Sign out of this device</Text>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Logging out..." : "Logout"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    alignItems: "center",
  },
  title: { fontSize: 28, fontWeight: "800", color: "#111" },
  subtitle: { marginTop: 6, fontSize: 14, color: "#666" },
  button: {
    marginTop: 24,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minWidth: 180,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
