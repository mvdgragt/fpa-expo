import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { setClubSession } from "../lib/session";
import { supabase } from "../lib/supabase";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<"clubs" | "users">("clubs");

  const [clubs, setClubs] = useState<
    { id: string; name: string; code_4: string; logo_path: string | null }[]
  >([]);
  const [users, setUsers] = useState<
    {
      id: string;
      club_id: string;
      first_name: string;
      last_name: string;
      dob: string | null;
      sex: string | null;
      image_url: string | null;
      created_at: string;
    }[]
  >([]);

  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  const [clubModalVisible, setClubModalVisible] = useState(false);
  const [clubEditingId, setClubEditingId] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [clubLogoUri, setClubLogoUri] = useState<string | null>(null);

  const [userModalVisible, setUserModalVisible] = useState(false);
  const [userEditingId, setUserEditingId] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [userDob, setUserDob] = useState<string>("");
  const [userSex, setUserSex] = useState<string>("");

  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, true>>(
    {},
  );
  const [selectionMode, setSelectionMode] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!selectedClubId) return users;
    return users.filter((u) => u.club_id === selectedClubId);
  }, [users, selectedClubId]);

  const selectedCount = useMemo(
    () => Object.keys(selectedUserIds).length,
    [selectedUserIds],
  );

  const toggleUserSelected = useCallback((id: string) => {
    setSelectedUserIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUserIds({});
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  const clubNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clubs) map[c.id] = c.name;
    return map;
  }, [clubs]);

  const ensureAdminAccess = async () => {
    try {
      const lastAuthIso = await AsyncStorage.getItem("adminLastAuthAt");
      if (lastAuthIso) {
        const last = new Date(lastAuthIso).getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (!Number.isNaN(last) && Date.now() - last > weekMs) {
          await supabase.auth.signOut();
          router.replace("/admin-login" as any);
          return false;
        }
      }
    } catch {
      // ignore
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/admin-login" as any);
      return false;
    }

    const { data: isAdmin, error: isAdminError } =
      await supabase.rpc("is_admin_user");
    if (isAdminError || !isAdmin) {
      await supabase.auth.signOut();
      router.replace("/admin-login" as any);
      return false;
    }

    try {
      await AsyncStorage.setItem("adminLastAuthAt", new Date().toISOString());
    } catch {
      // ignore
    }

    return true;
  };

  const loadClubs = useCallback(async () => {
    const { data, error } = await supabase
      .from("clubs")
      .select("id,name,code_4,logo_path")
      .order("name");
    if (error) throw error;
    setClubs((data || []) as any);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("club_users")
      .select("id,club_id,first_name,last_name,dob,sex,image_url,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setUsers(((data || []) as any) || []);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadClubs(), loadUsers()]);
  }, [loadClubs, loadUsers]);

  useEffect(() => {
    const boot = async () => {
      try {
        const ok = await ensureAdminAccess();
        if (!ok) return;
        await refresh();
      } catch (e) {
        console.error(e);
        Alert.alert(
          "Error",
          (e as any)?.message || "Failed to load admin data",
        );
      } finally {
        setIsBooting(false);
      }
    };

    boot();
  }, [refresh]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      try {
        const { data: isDemo } = await supabase.rpc("is_demo_account");
        if (isDemo) {
          await supabase.rpc("reset_demo_data");
        }
      } catch {
        // Ignore demo reset failures and proceed to sign out
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert("Error", "Could not sign out");
        return;
      }
      router.replace("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const previewAsClub = async (club: {
    id: string;
    name: string;
    code_4: string;
    logo_path: string | null;
  }) => {
    await setClubSession({
      type: "club",
      clubCode: String(club.code_4).trim(),
      clubId: club.id,
      clubName: club.name,
      clubLogoPath: club.logo_path || undefined,
      loginTime: new Date().toISOString(),
    });

    router.push({
      pathname: "/(tabs)/select-user" as any,
      params: { adminPreview: "1" },
    });
  };

  const openCreateClub = () => {
    setClubEditingId(null);
    setClubName("");
    setClubCode("");
    setClubLogoUri(null);
    setClubModalVisible(true);
  };

  const openEditClub = (club: {
    id: string;
    name: string;
    code_4: string;
    logo_path: string | null;
  }) => {
    setClubEditingId(club.id);
    setClubName(club.name);
    setClubCode(String(club.code_4 || "").trim());
    setClubLogoUri(null);
    setClubModalVisible(true);
  };

  const pickClubLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setClubLogoUri(result.assets[0].uri);
    }
  };

  const uploadLogoIfNeeded = async (clubId: string) => {
    if (!clubLogoUri) return null;
    const res = await fetch(clubLogoUri);
    const blob = await res.blob();
    const objectPath = `${clubId}/logo.png`;

    const { error: uploadError } = await supabase.storage
      .from("club-logos")
      .upload(objectPath, blob, {
        upsert: true,
        contentType: blob.type || "image/png",
      });

    if (uploadError) throw uploadError;
    return objectPath;
  };

  const saveClub = async () => {
    const name = clubName.trim();
    const code = clubCode.trim();
    if (!name) {
      Alert.alert("Error", "Club name is required");
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      Alert.alert("Error", "Club code must be exactly 4 digits");
      return;
    }

    try {
      const { data: existing, error: existingError } = await supabase
        .from("clubs")
        .select("id,name")
        .eq("code_4", code)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing && existing.id !== clubEditingId) {
        Alert.alert(
          "Code already in use",
          `Club code ${code} is already used by “${existing.name}”. Choose another code.`,
        );
        return;
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Could not validate club code");
      return;
    }

    setIsLoading(true);
    try {
      if (!clubEditingId) {
        const { data, error } = await supabase
          .from("clubs")
          .insert({ name, code_4: code })
          .select("id")
          .single();
        if (error) throw error;

        const clubId = data.id as string;
        const logoPath = await uploadLogoIfNeeded(clubId);
        if (logoPath) {
          const { error: updErr } = await supabase
            .from("clubs")
            .update({ logo_path: logoPath })
            .eq("id", clubId);
          if (updErr) throw updErr;
        }
      } else {
        const logoPath = await uploadLogoIfNeeded(clubEditingId);
        const payload: any = { name, code_4: code };
        if (logoPath) payload.logo_path = logoPath;
        const { error } = await supabase
          .from("clubs")
          .update(payload)
          .eq("id", clubEditingId);
        if (error) throw error;
      }

      setClubModalVisible(false);
      await loadClubs();
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      const isDuplicateCode =
        e?.code === "23505" || msg.includes("clubs_code_4_key");
      if (isDuplicateCode) {
        Alert.alert(
          "Code already in use",
          "That 4-digit club code is already taken. Please choose a different one.",
        );
      } else {
        Alert.alert("Error", e?.message || "Could not save club");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deleteClub = async (clubId: string) => {
    Alert.alert(
      "Delete club",
      "This will also delete all users in this club. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const { error } = await supabase
                .from("clubs")
                .delete()
                .eq("id", clubId);
              if (error) throw error;
              await refresh();
            } catch (e: any) {
              console.error(e);
              Alert.alert("Error", e?.message || "Could not delete club");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const openEditUser = (u: any) => {
    setUserEditingId(u.id);
    setUserFirstName(u.first_name || "");
    setUserLastName(u.last_name || "");
    setUserDob(u.dob || "");
    setUserSex(u.sex || "");
    setUserModalVisible(true);
  };

  const openCreateStaff = () => {
    if (!selectedClubId) {
      Alert.alert("Select club", "Select a club filter first.");
      return;
    }
    setStaffFirstName("");
    setStaffLastName("");
    setStaffEmail("");
    setStaffPhone("");
    setStaffModalVisible(true);
  };

  const createStaff = async () => {
    const clubId = selectedClubId;
    if (!clubId) return;
    const fn = staffFirstName.trim();
    const ln = staffLastName.trim();
    const email = staffEmail.trim().toLowerCase();
    const phone = staffPhone.trim();
    if (!fn || !ln || !email) {
      Alert.alert("Error", "First name, last name and email are required");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-club-staff",
        {
          body: {
            club_id: clubId,
            first_name: fn,
            last_name: ln,
            email,
            phone: phone || null,
          },
        },
      );
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.error || "Could not create staff user");
      }
      setStaffModalVisible(false);
      Alert.alert("Invite sent", `Invite email sent to ${email}`);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Could not create staff user");
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async () => {
    if (!userEditingId) return;
    const fn = userFirstName.trim();
    const ln = userLastName.trim();
    if (!fn || !ln) {
      Alert.alert("Error", "First name and last name are required");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("club_users")
        .update({
          first_name: fn,
          last_name: ln,
          dob: userDob.trim() || null,
          sex: userSex.trim() || null,
        })
        .eq("id", userEditingId);
      if (error) throw error;
      setUserModalVisible(false);
      await loadUsers();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Could not save user");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    Alert.alert("Delete user", "Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsLoading(true);
          try {
            const { error } = await supabase
              .from("club_users")
              .delete()
              .eq("id", userId);
            if (error) throw error;
            await loadUsers();
          } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e?.message || "Could not delete user");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const bulkDeleteSelectedUsers = async () => {
    const ids = Object.keys(selectedUserIds);
    if (ids.length === 0) return;

    Alert.alert("Delete selected users", `Delete ${ids.length} user(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsLoading(true);
          try {
            const { error } = await supabase
              .from("club_users")
              .delete()
              .in("id", ids);
            if (error) throw error;
            clearSelection();
            await loadUsers();
          } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e?.message || "Could not delete users");
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Admin</Text>
            <Text style={styles.subtitle}>Manage clubs and users</Text>
          </View>

          <TouchableOpacity
            style={[styles.signOutButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogout}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#111" />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "clubs" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("clubs")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "clubs" && styles.tabTextActive,
              ]}
            >
              Clubs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "users" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("users")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "users" && styles.tabTextActive,
              ]}
            >
              Users
            </Text>
          </TouchableOpacity>
        </View>

        {isBooting ? (
          <View style={styles.centerState}>
            <Text style={styles.centerStateText}>Loading...</Text>
          </View>
        ) : activeTab === "clubs" ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openCreateClub}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Add club</Text>
            </TouchableOpacity>

            <FlatList
              data={clubs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSub}>
                      Code: {String(item.code_4).trim()}
                    </Text>
                    <Text style={styles.cardSub}>
                      Logo: {item.logo_path || "-"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => previewAsClub(item)}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Ionicons name="eye-outline" size={20} color="#111" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEditClub(item)}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Ionicons name="create-outline" size={20} color="#111" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => deleteClub(item.id)}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              )}
            />
          </>
        ) : (
          <>
            <View style={styles.pillWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    !selectedClubId && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedClubId(null)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      !selectedClubId && styles.filterPillTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {clubs.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.filterPill,
                      selectedClubId === c.id && styles.filterPillActive,
                    ]}
                    onPress={() => setSelectedClubId(c.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedClubId === c.id && styles.filterPillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.usersToolbar}>
              <Text style={styles.usersToolbarHint}>
                {selectionMode ? "Tap users to select" : "Tap a user to edit"}
              </Text>
              <View style={styles.usersToolbarActions}>
                <TouchableOpacity
                  style={styles.usersToolbarButton}
                  onPress={openCreateStaff}
                  activeOpacity={0.8}
                >
                  <Text style={styles.usersToolbarButtonText}>Add staff</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.usersToolbarButton}
                  onPress={() => {
                    if (selectionMode) exitSelectionMode();
                    else setSelectionMode(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.usersToolbarButtonText}>
                    {selectionMode ? "Done" : "Select"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingBottom: selectionMode ? 120 : 30,
              }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (selectionMode) toggleUserSelected(item.id);
                    else openEditUser(item);
                  }}
                  onLongPress={() => {
                    if (!selectionMode) setSelectionMode(true);
                    toggleUserSelected(item.id);
                  }}
                >
                  <View
                    style={[
                      styles.card,
                      selectedUserIds[item.id] && styles.cardSelected,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.userTitleRow}>
                        {selectionMode ? (
                          <View
                            style={[
                              styles.selectDot,
                              selectedUserIds[item.id] &&
                                styles.selectDotSelected,
                            ]}
                          />
                        ) : null}
                        <Text style={styles.cardTitle}>
                          {item.first_name} {item.last_name}
                        </Text>
                      </View>
                      <Text style={styles.cardSub}>
                        Club: {clubNameById[item.club_id] || item.club_id}
                      </Text>
                      <Text style={styles.cardSub}>DOB: {item.dob || "-"}</Text>
                      <Text style={styles.cardSub}>Sex: {item.sex || "-"}</Text>
                    </View>

                    {!selectionMode ? (
                      <>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => openEditUser(item)}
                          activeOpacity={0.8}
                          disabled={isLoading}
                        >
                          <Ionicons
                            name="create-outline"
                            size={20}
                            color="#111"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => deleteUser(item.id)}
                          activeOpacity={0.8}
                          disabled={isLoading}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#b91c1c"
                          />
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />

            {selectionMode ? (
              <View style={[styles.bulkBar, { bottom: 16 + insets.bottom }]}>
                <Text style={styles.bulkBarText}>{selectedCount} selected</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={styles.bulkSecondary}
                    onPress={clearSelection}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Text style={styles.bulkSecondaryText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.bulkDanger,
                      selectedCount === 0 && styles.bulkDangerDisabled,
                    ]}
                    onPress={bulkDeleteSelectedUsers}
                    activeOpacity={0.8}
                    disabled={isLoading || selectedCount === 0}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.bulkDangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        )}

        <Modal
          visible={clubModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setClubModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={styles.modalCardClub}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text style={styles.modalTitle}>
                    {clubEditingId ? "Edit club" : "Add club"}
                  </Text>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="Club name"
                    value={clubName}
                    onChangeText={setClubName}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="4-digit code"
                    value={clubCode}
                    onChangeText={(t) =>
                      setClubCode(t.replace(/\D/g, "").slice(0, 4))
                    }
                    keyboardType="number-pad"
                    maxLength={4}
                  />

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={pickClubLogo}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Ionicons name="image-outline" size={18} color="#111" />
                    <Text style={styles.secondaryButtonText}>
                      {clubLogoUri ? "Change logo" : "Pick logo"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => setClubModalVisible(false)}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSaveButton}
                      onPress={saveClub}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.modalSaveText}>
                        {isLoading ? "Saving..." : "Save"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal
          visible={userModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setUserModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={styles.modalCard}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text style={styles.modalTitle}>Edit user</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="First name"
                    value={userFirstName}
                    onChangeText={setUserFirstName}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Last name"
                    value={userLastName}
                    onChangeText={setUserLastName}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="DOB (DD/MM/YYYY)"
                    value={userDob}
                    onChangeText={setUserDob}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Sex (male/female)"
                    value={userSex}
                    onChangeText={setUserSex}
                  />

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => setUserModalVisible(false)}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSaveButton}
                      onPress={saveUser}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.modalSaveText}>
                        {isLoading ? "Saving..." : "Save"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal
          visible={staffModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setStaffModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={styles.modalCard}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text style={styles.modalTitle}>Invite staff user</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="First name"
                    value={staffFirstName}
                    onChangeText={setStaffFirstName}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Last name"
                    value={staffLastName}
                    onChangeText={setStaffLastName}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Email"
                    value={staffEmail}
                    onChangeText={setStaffEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Phone (optional)"
                    value={staffPhone}
                    onChangeText={setStaffPhone}
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                  />

                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalCancelButton}
                      onPress={() => setStaffModalVisible(false)}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSaveButton}
                      onPress={createStaff}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.modalSaveText}>
                        {isLoading ? "Sending..." : "Send invite"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#111" },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  buttonDisabled: { opacity: 0.6 },
  signOutText: { color: "#111", fontSize: 14, fontWeight: "700" },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderColor: "#111",
  },
  tabText: { fontSize: 14, fontWeight: "700", color: "#666" },
  tabTextActive: { color: "#111" },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillWrapper: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  primaryButton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  cardSub: { marginTop: 2, fontSize: 12, color: "#666" },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  centerState: { paddingTop: 40, alignItems: "center" },
  centerStateText: { color: "#666", fontSize: 14, fontWeight: "600" },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    marginRight: 8, // 👈 spacing between pills
  },
  filterPillActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  filterPillText: { color: "#4b5563", fontSize: 13, fontWeight: "800" },
  filterPillTextActive: { color: "#fff" },
  usersToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  usersToolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  usersToolbarHint: { fontSize: 13, color: "#666" },
  usersToolbarButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  usersToolbarButtonText: { color: "#111", fontSize: 13, fontWeight: "900" },
  userTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  selectDotSelected: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  cardSelected: {
    borderColor: "#111",
    backgroundColor: "#f3f4f6",
  },
  bulkBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: "#111",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkBarText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  bulkSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bulkSecondaryText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  bulkDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#b91c1c",
  },
  bulkDangerDisabled: { opacity: 0.5 },
  bulkDangerText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "92%",
  },
  modalCardClub: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: "96%",
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  modalInput: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
  },
  secondaryButton: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#111", fontSize: 14, fontWeight: "800" },
  modalButtonsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalCancelButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  modalCancelText: { color: "#666", fontSize: 15, fontWeight: "800" },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  modalSaveText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
