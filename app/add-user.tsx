import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useGlobalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getClubSession } from "../lib/session";
import { supabase } from "../lib/supabase";

type Sex = "male" | "female" | "";

export default function AddUserScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [dobModalVisible, setDobModalVisible] = useState(false);
  const [dobDay, setDobDay] = useState<number | null>(null);
  const [dobMonth, setDobMonth] = useState<number | null>(null);
  const [dobYear, setDobYear] = useState<number | null>(null);
  const [sex, setSex] = useState<Sex>("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const params = useGlobalSearchParams();
  const { stationId, stationName, stationShortName } = params;

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const formatDob = (day: number, month: number, year: number) => {
    return `${pad2(day)}/${pad2(month)}/${year}`;
  };

  const parseDob = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (
      !Number.isFinite(day) ||
      !Number.isFinite(month) ||
      !Number.isFinite(year)
    ) {
      return null;
    }
    if (day < 1 || day > 31) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900) return null;
    return { day, month, year };
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const openDobModal = () => {
    const parsed = parseDob(dob);
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = now.getMonth() + 1;
    const defaultDay = now.getDate();

    const nextDay = parsed?.day ?? defaultDay;
    const nextMonth = parsed?.month ?? defaultMonth;
    const nextYear = parsed?.year ?? defaultYear;

    setDobDay(nextDay);
    setDobMonth(nextMonth);
    setDobYear(nextYear);
    setDobModalVisible(true);
  };

  const closeDobModal = () => {
    setDobModalVisible(false);
  };

  const confirmDob = () => {
    if (!dobDay || !dobMonth || !dobYear) {
      closeDobModal();
      return;
    }

    const maxDay = getDaysInMonth(dobYear, dobMonth);
    const safeDay = Math.min(dobDay, maxDay);
    setDob(formatDob(safeDay, dobMonth, dobYear));
    closeDobModal();
  };

  const pickImage = async (source: "camera" | "library") => {
    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Camera access is required to take a photo.",
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Photo library access is required to choose a photo.",
        );
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    }

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadProfilePhoto = async (localUri: string, objectPath: string) => {
    const extra = (Constants.expoConfig?.extra || {}) as {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
    const supabaseUrl = extra.SUPABASE_URL;
    const supabaseAnonKey = extra.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase env. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      );
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error("Not signed in. Please sign in again.");
    }

    const endpoint = `${supabaseUrl}/storage/v1/object/user-photos/${objectPath}`;
    const fs: any = FileSystem as any;
    const uploadRes = await FileSystem.uploadAsync(endpoint, localUri, {
      httpMethod: "POST",
      uploadType:
        fs.FileSystemUploadType?.BINARY_CONTENT ??
        fs.FileSystemUploadType?.BINARY ??
        undefined,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
    });

    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      throw new Error(
        uploadRes.body || `Upload failed with status ${uploadRes.status}`,
      );
    }

    const { data } = supabase.storage
      .from("user-photos")
      .getPublicUrl(objectPath);
    if (!data?.publicUrl)
      throw new Error("Could not create public URL for uploaded photo");
    return data.publicUrl;
  };

  const showImageOptions = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage("camera");
          if (buttonIndex === 2) pickImage("library");
        },
      );
    } else {
      Alert.alert("Profile Picture", "Choose an option", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => pickImage("camera") },
        { text: "Choose from Library", onPress: () => pickImage("library") },
      ]);
    }
  };

  const persistProfilePhoto = async (sourceUri: string, userIdHint: string) => {
    const fs: any = FileSystem as any;
    const documentDir =
      (fs.documentDirectory as string | null | undefined) ??
      (fs.cacheDirectory as string | null | undefined) ??
      null;
    const baseDir = documentDir ? `${documentDir}user-photos` : null;
    try {
      if (!baseDir) return sourceUri;
      const dirInfo = await FileSystem.getInfoAsync(baseDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
      }

      const ext = (() => {
        const match = sourceUri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
        const e = match?.[1]?.toLowerCase();
        if (e && e.length <= 5) return e;
        return "jpg";
      })();

      const fileName = `${userIdHint}-${Date.now()}.${ext}`;
      const destUri = `${baseDir}/${fileName}`;
      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
      return destUri;
    } catch {
      return sourceUri;
    }
  };

  const handleAddUser = async () => {
    if (isSaving) return;
    if (!firstName.trim()) {
      Alert.alert("Error", "Please enter a first name");
      return;
    }
    if (!lastName.trim()) {
      Alert.alert("Error", "Please enter a last name");
      return;
    }
    if (!dob) {
      Alert.alert("Error", "Please select a date of birth");
      return;
    }
    if (!sex) {
      Alert.alert("Error", "Please select a sex");
      return;
    }
    if (!imageUri) {
      Alert.alert("Error", "Please add a photo");
      return;
    }

    setIsSaving(true);
    const session = await getClubSession();
    if (!session) {
      Alert.alert("Error", "No active club session. Please login again.");
      router.replace("/login");
      setIsSaving(false);
      return;
    }

    const userIdHint = `${firstName.trim()}-${lastName.trim()}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const persistedUri = await persistProfilePhoto(
      imageUri,
      userIdHint || "user",
    );

    let imageUrl = persistedUri;
    try {
      const ext = (() => {
        const match = persistedUri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
        const e = match?.[1]?.toLowerCase();
        if (e && e.length <= 5) return e;
        return "jpg";
      })();

      const objectPath = `${session.clubId}/${userIdHint || "user"}-${Date.now()}.${ext}`;
      imageUrl = await uploadProfilePhoto(persistedUri, objectPath);
    } catch (e: any) {
      console.error("Error uploading profile photo:", e);
      Alert.alert(
        "Upload failed",
        "Could not upload the profile photo. Please try again.",
      );
      return;
    }

    try {
      const { error } = await supabase.rpc("create_club_user", {
        club_code: session.clubCode,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dob || null,
        sex: sex || null,
        image_url: imageUrl,
      });

      if (error) {
        console.error("Error creating user:", error);
        Alert.alert(
          "Error",
          error.message || "Could not create user. Please try again.",
        );
        return;
      }

      router.replace({
        pathname: "/(tabs)/select-user",
        params: {
          stationId: stationId as any,
          stationName: stationName as any,
          stationShortName: stationShortName as any,
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Add New User</Text>
        <Text style={styles.subtitle}>Fill in the details below</Text>

        {/* Profile Picture */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={showImageOptions}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="camera" size={32} color="#999" />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="pencil" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to add a photo</Text>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Last name"
            value={lastName}
            onChangeText={setLastName}
            returnKeyType="next"
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={openDobModal}
            activeOpacity={0.8}
          >
            <Text style={dob ? styles.dobText : styles.dobPlaceholder}>
              {dob || "DD/MM/YYYY"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Sex</Text>
          <View style={styles.sexContainer}>
            <TouchableOpacity
              style={[
                styles.sexButton,
                sex === "male" && styles.sexButtonActive,
              ]}
              onPress={() => setSex("male")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="male"
                size={20}
                color={sex === "male" ? "#fff" : "#666"}
              />
              <Text
                style={[
                  styles.sexButtonText,
                  sex === "male" && styles.sexButtonTextActive,
                ]}
              >
                Male
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sexButton,
                sex === "female" && styles.sexButtonActive,
              ]}
              onPress={() => setSex("female")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="female"
                size={20}
                color={sex === "female" ? "#fff" : "#666"}
              />
              <Text
                style={[
                  styles.sexButtonText,
                  sex === "female" && styles.sexButtonTextActive,
                ]}
              >
                Female
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.addButton, isSaving && { opacity: 0.7 }]}
            onPress={handleAddUser}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <Text style={styles.addButtonText}>
              {isSaving ? "Saving..." : "Add User"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={dobModalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeDobModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeaderRow}>
                <View style={{ width: 36 }} />
                <View style={styles.modalHeaderTextWrap}>
                  <Text style={styles.modalTitle}>Date of birth</Text>
                  <Text style={styles.modalSubtitle}>
                    Pick day, month and year
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closeDobModal}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <View style={styles.dobPickerRow}>
                <View style={styles.dobPickerColumn}>
                  <Text style={styles.dobPickerLabel}>Day</Text>
                  <ScrollView style={styles.dobPickerList}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <TouchableOpacity
                        key={`d-${d}`}
                        style={[
                          styles.dobPickerItem,
                          dobDay === d && styles.dobPickerItemActive,
                        ]}
                        onPress={() => setDobDay(d)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dobPickerItemText,
                            dobDay === d && styles.dobPickerItemTextActive,
                          ]}
                        >
                          {pad2(d)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.dobPickerColumn}>
                  <Text style={styles.dobPickerLabel}>Month</Text>
                  <ScrollView style={styles.dobPickerList}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <TouchableOpacity
                        key={`m-${m}`}
                        style={[
                          styles.dobPickerItem,
                          dobMonth === m && styles.dobPickerItemActive,
                        ]}
                        onPress={() => setDobMonth(m)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dobPickerItemText,
                            dobMonth === m && styles.dobPickerItemTextActive,
                          ]}
                        >
                          {monthNames[m - 1]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.dobPickerColumn}>
                  <Text style={styles.dobPickerLabel}>Year</Text>
                  <ScrollView style={styles.dobPickerList}>
                    {Array.from(
                      { length: new Date().getFullYear() - 1900 + 1 },
                      (_, i) => new Date().getFullYear() - i,
                    ).map((y) => (
                      <TouchableOpacity
                        key={`y-${y}`}
                        style={[
                          styles.dobPickerItem,
                          dobYear === y && styles.dobPickerItemActive,
                        ]}
                        onPress={() => {
                          setDobYear(y);
                          if (dobMonth && dobDay) {
                            const maxDay = getDaysInMonth(y, dobMonth);
                            if (dobDay > maxDay) setDobDay(maxDay);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dobPickerItemText,
                            dobYear === y && styles.dobPickerItemTextActive,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={closeDobModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalDoneButton}
                  onPress={confirmDob}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDoneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  avatarContainer: {
    alignSelf: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#e8e8e8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#d0d0d0",
    borderStyle: "dashed",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#007AFF",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#f8f9fa",
  },
  avatarHint: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginBottom: 24,
  },
  formContainer: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 16,
  },
  dobPlaceholder: {
    fontSize: 16,
    color: "#999",
  },
  dobText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    marginBottom: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalHeaderTextWrap: {
    flex: 1,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dobPickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  dobPickerColumn: {
    flex: 1,
  },
  dobPickerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  dobPickerList: {
    maxHeight: 220,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#f8fafc",
  },
  dobPickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    marginVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dobPickerItemActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#6d28d9",
  },
  dobPickerItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  dobPickerItemTextActive: {
    color: "#fff",
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  modalCancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  modalDoneButton: {
    flex: 1,
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  modalDoneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sexContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  sexButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  sexButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  sexButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  sexButtonTextActive: {
    color: "#fff",
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
});
