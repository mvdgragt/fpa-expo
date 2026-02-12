import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useGlobalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
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

export default function EditUserScreen() {
  const params = useGlobalSearchParams();

  const userId = typeof params.userId === "string" ? params.userId : "";
  const initialFirstName =
    typeof params.firstName === "string" ? params.firstName : "";
  const initialLastName =
    typeof params.lastName === "string" ? params.lastName : "";
  const initialDob = typeof params.dob === "string" ? params.dob : "";
  const initialSex = (typeof params.sex === "string"
    ? params.sex
    : "") as Sex;
  const initialImageUrl =
    typeof params.imageUrl === "string" ? params.imageUrl : "";

  const { stationId, stationName, stationShortName } = params;

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [dob, setDob] = useState(initialDob);
  const [sex, setSex] = useState<Sex>(initialSex);
  const [imageUri, setImageUri] = useState<string>(initialImageUrl);
  const [isSaving, setIsSaving] = useState(false);

  const [dobModalVisible, setDobModalVisible] = useState(false);
  const [dobDay, setDobDay] = useState<number | null>(null);
  const [dobMonth, setDobMonth] = useState<number | null>(null);
  const [dobYear, setDobYear] = useState<number | null>(null);

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const monthNames = useMemo(
    () => [
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
    ],
    [],
  );

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
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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

    const { data } = supabase.storage.from("user-photos").getPublicUrl(objectPath);
    if (!data?.publicUrl) {
      throw new Error("Could not create public URL for uploaded photo");
    }

    return data.publicUrl;
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!userId) {
      Alert.alert("Error", "Missing user id.");
      return;
    }
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

    setIsSaving(true);
    try {
      const session = await getClubSession();
      if (!session) {
        Alert.alert("Error", "No active club session. Please login again.");
        router.replace("/login");
        return;
      }

      let nextImageUrl = initialImageUrl;
      const hasNewLocalPhoto =
        typeof imageUri === "string" &&
        imageUri.length > 0 &&
        !imageUri.startsWith("http");

      if (hasNewLocalPhoto) {
        const userIdHint = `${firstName.trim()}-${lastName.trim()}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const persistedUri = await persistProfilePhoto(
          imageUri,
          userIdHint || "user",
        );

        const ext = (() => {
          const match = persistedUri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
          const e = match?.[1]?.toLowerCase();
          if (e && e.length <= 5) return e;
          return "jpg";
        })();

        const objectPath = `${session.clubId}/${userIdHint || "user"}-${Date.now()}.${ext}`;
        nextImageUrl = await uploadProfilePhoto(persistedUri, objectPath);
      }

      const { error } = await supabase
        .from("club_users")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: dob || null,
          sex: sex || null,
          image_url: nextImageUrl || null,
        })
        .eq("id", userId);

      if (error) {
        console.error("Error updating user:", error);
        Alert.alert(
          "Save failed",
          error.message || "Could not update the user. Please try again.",
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
    } catch (e: any) {
      console.error("Error saving user:", e);
      Alert.alert("Save failed", e?.message || "Could not update the user.");
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#007AFF" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit User</Text>
        </View>

        <TouchableOpacity
          style={styles.imagePicker}
          onPress={showImageOptions}
          activeOpacity={0.8}
        >
          <Image
            source={{
              uri:
                imageUri && typeof imageUri === "string"
                  ? imageUri
                  : "https://www.gravatar.com/avatar/?d=mp&f=y",
            }}
            style={styles.profileImage}
          />
          <Text style={styles.imagePickerText}>Change Photo</Text>
        </TouchableOpacity>

        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
        />

        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity
          style={styles.dobButton}
          onPress={openDobModal}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar" size={18} color="#666" />
          <Text style={styles.dobText}>{dob || "Select date"}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Sex</Text>
        <View style={styles.sexRow}>
          <TouchableOpacity
            style={[styles.sexButton, sex === "male" ? styles.sexActive : null]}
            onPress={() => setSex("male")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.sexButtonText,
                sex === "male" ? styles.sexActiveText : null,
              ]}
            >
              Male
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sexButton,
              sex === "female" ? styles.sexActive : null,
            ]}
            onPress={() => setSex("female")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.sexButtonText,
                sex === "female" ? styles.sexActiveText : null,
              ]}
            >
              Female
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : null]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={dobModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDobModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date of Birth</Text>

            <View style={styles.dobPickerRow}>
              <View style={styles.dobPickerCol}>
                <Text style={styles.pickerLabel}>Day</Text>
                <ScrollView style={styles.pickerList}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.pickerItem,
                        dobDay === d ? styles.pickerItemActive : null,
                      ]}
                      onPress={() => setDobDay(d)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          dobDay === d ? styles.pickerItemTextActive : null,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.dobPickerCol}>
                <Text style={styles.pickerLabel}>Month</Text>
                <ScrollView style={styles.pickerList}>
                  {monthNames.map((m, idx) => {
                    const month = idx + 1;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.pickerItem,
                          dobMonth === month ? styles.pickerItemActive : null,
                        ]}
                        onPress={() => setDobMonth(month)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            dobMonth === month
                              ? styles.pickerItemTextActive
                              : null,
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.dobPickerCol}>
                <Text style={styles.pickerLabel}>Year</Text>
                <ScrollView style={styles.pickerList}>
                  {Array.from(
                    { length: 80 },
                    (_, i) => new Date().getFullYear() - i,
                  ).map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.pickerItem,
                        dobYear === y ? styles.pickerItemActive : null,
                      ]}
                      onPress={() => setDobYear(y)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          dobYear === y ? styles.pickerItemTextActive : null,
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={closeDobModal}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmDob}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  backText: {
    color: "#007AFF",
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  imagePicker: {
    alignSelf: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#e9ecef",
  },
  imagePickerText: {
    marginTop: 10,
    color: "#007AFF",
    fontWeight: "700",
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#444",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1a1a1a",
  },
  dobButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dobText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  sexRow: {
    flexDirection: "row",
    gap: 10,
  },
  sexButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  sexButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#666",
  },
  sexActive: {
    borderColor: "#007AFF",
    backgroundColor: "#eaf2ff",
  },
  sexActiveText: {
    color: "#007AFF",
  },
  saveButton: {
    marginTop: 22,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "75%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 12,
  },
  dobPickerRow: {
    flexDirection: "row",
    gap: 10,
  },
  dobPickerCol: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginBottom: 6,
    textAlign: "center",
  },
  pickerList: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    maxHeight: 260,
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: "center",
  },
  pickerItemActive: {
    backgroundColor: "#eaf2ff",
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  pickerItemTextActive: {
    color: "#007AFF",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f3f5",
    alignItems: "center",
  },
  modalButtonPrimary: {
    backgroundColor: "#007AFF",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#333",
  },
  modalButtonTextPrimary: {
    color: "#fff",
  },
});
