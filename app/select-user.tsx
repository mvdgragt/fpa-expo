import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useGlobalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelectedUser } from "../context/SelectedUserContext";
import { clearClubSession, getClubSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import {
  extractUserPhotoObjectPath,
  getSignedUserPhotoUrl,
} from "../lib/user-photos";

type UserType = {
  id: string;
  name: string;
  imagePath: string;
  signedImageUrl: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex: string;
};

export default function SelectUserScreen() {
  const params = useGlobalSearchParams();
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clubName, setClubName] = useState<string>("");
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, true>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const { stationId, stationName, stationShortName } = params;
  const { setUser } = useSelectedUser();
  const insets = useSafeAreaInsets();

  const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp&f=y";

  const adminPreview = params.adminPreview === "1";
  const [isAdmin, setIsAdmin] = useState(false);
  const canAddUser = !adminPreview || isAdmin;

  const handleBackToAdmin = async () => {
    await clearClubSession();
    router.replace("/admin" as any);
  };

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase.rpc("is_admin_user");
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
    };
    check();
  }, []);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await getClubSession();
      if (!session) {
        Alert.alert("Error", "No active club session. Please login again.");
        router.replace("/login");
        return;
      }

      setClubName(session.clubName || "");
      if (session.clubLogoPath) {
        const { data } = supabase.storage
          .from("club-logos")
          .getPublicUrl(session.clubLogoPath);
        setClubLogoUrl(data.publicUrl || null);
      } else {
        setClubLogoUrl(null);
      }
      const { data, error } = await supabase.rpc("list_club_users", {
        club_code: session.clubCode,
      });

      if (error) {
        console.error("Error loading users:", error);
        setUsers([]);
        return;
      }

      const mapped: UserType[] = (data || []).map((u: any) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        imagePath: typeof u.image_url === "string" ? u.image_url.trim() : "",
        signedImageUrl: "",
        firstName: typeof u.first_name === "string" ? u.first_name : "",
        lastName: typeof u.last_name === "string" ? u.last_name : "",
        dob: typeof u.dob === "string" ? u.dob : "",
        sex: typeof u.sex === "string" ? u.sex : "",
      }));
      setUsers(mapped);
      try {
        const withSigned = await Promise.all(
          mapped.map(async (u) => {
            const path = extractUserPhotoObjectPath(u.imagePath);
            const url = path ? await getSignedUserPhotoUrl(path) : "";
            return { ...u, signedImageUrl: url };
          }),
        );
        setUsers(withSigned);
      } catch {
        // ignore
      }
      setImageErrors({});
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load users from storage on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers]),
  );

  const handleUserSelect = useCallback(
    (selectedUser: UserType) => {
      // Set user in context
      setUser({
        id: selectedUser.id,
        name: selectedUser.name,
        image: selectedUser.imagePath || "",
      });

      // Navigate immediately
      router.push({
        pathname: "/(tabs)/testing",
        params: {
          stationId,
          stationName,
          stationShortName,
        },
      });
    },
    [setUser, stationId, stationName, stationShortName],
  );

  const handleAddUser = () => {
    router.push({
      pathname: "/add-user",
      params: { stationId, stationName, stationShortName },
    });
  };

  const handleDeleteUser = useCallback(
    (u: UserType) => {
      Alert.alert(
        "Delete user",
        `Are you sure you want to delete ${u.name}? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const session = await getClubSession();
                if (!session) {
                  Alert.alert(
                    "Error",
                    "No active club session. Please login again.",
                  );
                  router.replace("/login");
                  return;
                }

                const { error } = await supabase
                  .from("club_users")
                  .delete()
                  .eq("id", u.id);

                if (error) {
                  console.error("Error deleting user:", error);
                  Alert.alert(
                    "Delete failed",
                    error.message || "Could not delete the user.",
                  );
                  return;
                }

                await loadUsers();
              } catch (e: any) {
                console.error("Error deleting user:", e);
                Alert.alert(
                  "Delete failed",
                  e?.message || "Could not delete the user.",
                );
              }
            },
          },
        ],
      );
    },
    [loadUsers],
  );

  const handleEditUser = useCallback(
    (u: UserType) => {
      router.push({
        pathname: "/edit-user",
        params: {
          userId: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          dob: u.dob,
          sex: u.sex,
          imageUrl: u.imagePath,
          stationId,
          stationName,
          stationShortName,
        },
      });
    },
    [stationId, stationName, stationShortName],
  );

  const UserCard = ({
    item,
    editing,
  }: {
    item: UserType;
    editing: boolean;
  }) => {
    const wiggle = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (!editing) {
        wiggle.stopAnimation();
        wiggle.setValue(0);
        return;
      }

      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(wiggle, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(wiggle, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
          }),
        ]),
      );

      anim.start();
      return () => anim.stop();
    }, [editing, wiggle]);

    const rotate = wiggle.interpolate({
      inputRange: [0, 1],
      outputRange: ["-1.6deg", "1.6deg"],
    });

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => {
          if (editing) return;
          handleUserSelect(item);
        }}
        onLongPress={() => setIsEditMode(true)}
        activeOpacity={0.7}
      >
        <Animated.View
          style={{ alignItems: "center", transform: [{ rotate }] }}
        >
          <Image
            key={`${item.id}:${item.imagePath}:${item.signedImageUrl}`}
            source={{
              uri:
                item.signedImageUrl && !imageErrors[item.id]
                  ? item.signedImageUrl
                  : defaultAvatarUrl,
              cache: item.signedImageUrl ? "reload" : "default",
            }}
            style={styles.userImage}
            onError={() =>
              setImageErrors((prev) => ({
                ...prev,
                [item.id]: true,
              }))
            }
          />
          <Text style={styles.userName}>{item.name}</Text>
        </Animated.View>

        {editing ? (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteUser(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => handleEditUser(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="create" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderUser = ({ item }: { item: UserType }) => (
    <UserCard item={item} editing={isEditMode} />
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isEditMode ? (
        <TouchableOpacity
          style={[styles.doneButton, { top: insets.top + 8 }]}
          onPress={() => setIsEditMode(false)}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      ) : null}

      {adminPreview ? (
        <TouchableOpacity
          style={[styles.logoutButton, { top: insets.top + 8 }]}
          onPress={handleBackToAdmin}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back-outline" size={18} color="#666" />
          <Text style={styles.logoutButtonText}>Back to admin</Text>
        </TouchableOpacity>
      ) : null}

      {clubName && (
        <View style={styles.clubBadge}>
          <Ionicons name="business" size={16} color="#fff" />
          <Text style={styles.clubBadgeText}>{clubName}</Text>
        </View>
      )}

      {clubLogoUrl && (
        <View style={styles.clubLogoWrap}>
          <Image source={{ uri: clubLogoUrl }} style={styles.clubLogo} />
        </View>
      )}

      {stationShortName && (
        <View style={styles.stationBadge}>
          <Ionicons name="fitness" size={16} color="#fff" />
          <Text style={styles.stationBadgeText}>
            Testing: {stationShortName}
          </Text>
        </View>
      )}

      <Text style={styles.title}>Select a User</Text>
      <Text style={styles.subtitle}>
        Choose who you want to test ({users.length} user
        {users.length !== 1 ? "s" : ""})
      </Text>

      {canAddUser ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddUser}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add New User</Text>
        </TouchableOpacity>
      ) : null}

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptySubtitle}>
            Add a new user to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  doneButton: {
    position: "absolute",
    top: 18,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#007AFF",
    zIndex: 12,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  logoutButton: {
    position: "absolute",
    top: 18,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    zIndex: 10,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 40,
  },
  clubBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clubBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  clubLogoWrap: {
    alignSelf: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  clubLogo: {
    width: 86,
    height: 86,
    resizeMode: "contain",
    borderRadius: 12,
  },
  stationBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stationBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    marginBottom: 16,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  userCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  editActions: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  editButton: {
    backgroundColor: "#007AFF",
  },
  userImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
  },
});
