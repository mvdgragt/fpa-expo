import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setAthleteSession } from "../lib/session";
import { supabase } from "../lib/supabase";

type ClubUser = {
  id: string;
  first_name: string;
  last_name: string;
};

export default function AthleteLoginScreen() {
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"code" | "pick">("code");
  const [isLoading, setIsLoading] = useState(false);
  const [club, setClub] = useState<{ id: string; name: string } | null>(null);
  const [athletes, setAthletes] = useState<ClubUser[]>([]);
  const [error, setError] = useState("");

  const handleFindClub = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4 || c.length > 6) {
      setError("Enter your 4–6 character club code");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const { data, error: clubError } = await supabase
        .from("clubs")
        .select("id,name")
        .eq("code_4", c)
        .maybeSingle();

      if (clubError || !data) {
        setError("Club not found — check your code and try again");
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from("club_users")
        .select("id,first_name,last_name")
        .eq("club_id", data.id)
        .order("first_name");

      if (usersError) {
        setError("Could not load athletes — please try again");
        return;
      }

      setClub({ id: data.id, name: data.name });
      setAthletes(users ?? []);
      setStage("pick");
    } catch {
      setError("Network error — check your connection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAthlete = async (user: ClubUser) => {
    if (!club) return;
    const name = `${user.first_name} ${user.last_name}`.trim();
    await setAthleteSession({
      type: "athlete",
      clubId: club.id,
      clubName: club.name,
      userId: user.id,
      userName: name,
      loginTime: new Date().toISOString(),
    });
    router.replace({
      pathname: "/athlete-dashboard",
      params: { userId: user.id, clubId: club.id },
    } as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#ff7e21" />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <View style={s.content}>
          {/* Logo */}
          <View style={s.logoWrap}>
            <Image
              source={require("../assets/images/fpa.png")}
              style={s.logo}
            />
            <Text style={s.title}>Athlete Portal</Text>
            <Text style={s.subtitle}>
              {stage === "code"
                ? "Enter your club code to view your results"
                : `${club?.name} — select your name`}
            </Text>
          </View>

          {stage === "code" ? (
            <View style={s.form}>
              <View style={[s.inputRow, error ? s.inputError : null]}>
                <Ionicons
                  name="key-outline"
                  size={22}
                  color="#888"
                  style={s.inputIcon}
                />
                <TextInput
                  style={s.input}
                  placeholder="Club code (e.g. EKEB or EKEB23)"
                  placeholderTextColor="#aaa"
                  value={code}
                  onChangeText={(t) => {
                    setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                    setError("");
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={handleFindClub}
                />
              </View>

              {error !== "" && (
                <View style={s.errorRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color="#ef4444"
                  />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.btn, isLoading && s.btnDisabled]}
                onPress={handleFindClub}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.btnText}>Find my club</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.pickWrap}>
              {athletes.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={s.emptyText}>
                    No athletes found for this club
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={athletes}
                  keyExtractor={(a) => a.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={s.athleteRow}
                      onPress={() => handleSelectAthlete(item)}
                      activeOpacity={0.75}
                    >
                      <View style={s.avatarCircle}>
                        <Text style={s.avatarInitials}>
                          {item.first_name?.[0] ?? ""}
                          {item.last_name?.[0] ?? ""}
                        </Text>
                      </View>
                      <Text style={s.athleteName}>
                        {item.first_name} {item.last_name}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={s.separator} />}
                />
              )}

              <TouchableOpacity
                style={s.changeClub}
                onPress={() => {
                  setStage("code");
                  setCode("");
                  setError("");
                }}
              >
                <Text style={s.changeClubText}>Use a different club code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f9fa" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 16,
    paddingBottom: 0,
  },
  backText: { color: "#ff7e21", fontWeight: "600", fontSize: 15 },
  content: { flex: 1, paddingHorizontal: 24 },
  logoWrap: { alignItems: "center", marginTop: 16, marginBottom: 32 },
  logo: { width: 80, height: 65, resizeMode: "contain" },
  title: { fontSize: 26, fontWeight: "bold", color: "#1a1a1a", marginTop: 12 },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 16,
  },
  form: { gap: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    paddingHorizontal: 14,
  },
  inputError: { borderColor: "#ef4444" },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: { color: "#ef4444", fontSize: 13 },
  btn: {
    backgroundColor: "#ff7e21",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  pickWrap: { flex: 1 },
  athleteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ff7e21",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  athleteName: { flex: 1, fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  separator: { height: 8 },
  emptyWrap: { alignItems: "center", gap: 12, paddingTop: 40 },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center" },
  changeClub: { alignItems: "center", paddingVertical: 20 },
  changeClubText: { color: "#ff7e21", fontWeight: "600", fontSize: 14 },
});
