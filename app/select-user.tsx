import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useGlobalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

type UserType = {
  id: string;
  name: string;
  image: string;
};

export default function SelectUserScreen() {
  const params = useGlobalSearchParams();
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clubName, setClubName] = useState<string>("");
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const { stationId, stationName, stationShortName } = params;
  const { setUser } = useSelectedUser();
  const insets = useSafeAreaInsets();

  const adminPreview = params.adminPreview === "1";
  const [isAdmin, setIsAdmin] = useState(false);
  const canAddUser = !adminPreview || isAdmin;

  const handleBackToAdmin = async () => {
    await clearClubSession();
    router.replace("/admin" as any);
  };

  // Load users from storage on mount
  useEffect(() => {
    loadUsers();
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, []),
  );

  const loadUsers = async () => {
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
        image: u.image_url,
      }));
      setUsers(mapped);
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = useCallback(
    (selectedUser: UserType) => {
      // Set user in context
      setUser({
        id: selectedUser.id,
        name: selectedUser.name,
        image: selectedUser.image,
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

  const renderUser = ({ item }: { item: UserType }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserSelect(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.image }} style={styles.userImage} />
      <Text style={styles.userName}>{item.name}</Text>
    </TouchableOpacity>
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
