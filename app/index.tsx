import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getClubSession, setClubSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export default function Index() {
  // Removed unused isChecking state

  const checkLoginStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: isAdmin } = await supabase.rpc("is_admin_user");
      if (isAdmin) {
        router.replace("/admin" as any);
        return;
      }

      const existingClubSession = await getClubSession();
      if (existingClubSession) {
        router.replace("/(tabs)/select-user" as any);
        return;
      }

      const { data: staffRow } = await supabase
        .from("club_staff")
        .select("club_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staffRow?.club_id) {
        router.replace("/login");
        return;
      }

      const { data: club } = await supabase
        .from("clubs")
        .select("id,name,code_4,logo_path")
        .eq("id", staffRow.club_id)
        .single();

      if (!club) {
        router.replace("/login");
        return;
      }

      await setClubSession({
        type: "club",
        clubCode: String(club.code_4),
        clubId: club.id,
        clubName: club.name,
        clubLogoPath: club.logo_path || undefined,
        loginTime: new Date().toISOString(),
      });

      router.replace("/(tabs)/select-user" as any);
    } catch (error) {
      console.error("Error checking login status:", error);
      router.replace("/login");
    }
  };

  useEffect(() => {
    checkLoginStatus();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
});
