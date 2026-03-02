import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  getClubSession,
  setAthleteSession,
  setClubSession,
} from "../lib/session";
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

      if (staffRow?.club_id) {
        const { data: club } = await supabase
          .from("clubs")
          .select("id,name,code_4,logo_path")
          .eq("id", staffRow.club_id)
          .single();

        if (club) {
          await setClubSession({
            type: "club",
            clubCode: String(club.code_4),
            clubId: club.id,
            clubName: club.name,
            clubLogoPath: club.logo_path || undefined,
            loginTime: new Date().toISOString(),
          });
          router.replace("/(tabs)/select-user" as any);
          return;
        }
      }

      // Check if this is an athlete (club_users with matching email)
      const { data: athleteRow } = await supabase
        .from("club_users")
        .select("id,club_id,first_name,last_name")
        .eq("email", user.email ?? "")
        .maybeSingle();

      if (athleteRow?.id) {
        const { data: club } = await supabase
          .from("clubs")
          .select("id,name")
          .eq("id", athleteRow.club_id)
          .maybeSingle();

        await setAthleteSession({
          type: "athlete",
          clubId: athleteRow.club_id,
          clubName: club?.name ?? "",
          userId: athleteRow.id,
          userName: `${athleteRow.first_name} ${athleteRow.last_name}`.trim(),
          loginTime: new Date().toISOString(),
        });
        router.replace("/athlete-dashboard" as any);
        return;
      }

      router.replace("/login");
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
      <ActivityIndicator size="large" color="#ff7e21" />
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
