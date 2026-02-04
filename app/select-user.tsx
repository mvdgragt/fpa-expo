import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useSelectedUser } from "../context/SelectedUserContext";

type UserType = {
  id: string;
  name: string;
  image: string;
  clubId?: string;
};

const STORAGE_KEY = "@users_list";

// Updated INITIAL_USERS with clubId
const INITIAL_USERS: UserType[] = [
  {
    id: "1",
    name: "Alex Johnson",
    image: "https://randomuser.me/api/portraits/men/1.jpg",
    clubId: "club1",
  },
  {
    id: "2",
    name: "Sophia Martinez",
    image: "https://randomuser.me/api/portraits/women/2.jpg",
    clubId: "club1",
  },
  {
    id: "3",
    name: "Michael Brown",
    image: "https://randomuser.me/api/portraits/men/3.jpg",
    clubId: "club1",
  },
  {
    id: "4",
    name: "Emma Wilson",
    image: "https://randomuser.me/api/portraits/women/4.jpg",
    clubId: "club2",
  },
  {
    id: "5",
    name: "Daniel Lee",
    image: "https://randomuser.me/api/portraits/men/5.jpg",
    clubId: "club2",
  },
  {
    id: "6",
    name: "Olivia Taylor",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
    clubId: "club2",
  },
  {
    id: "7",
    name: "James Anderson",
    image: "https://randomuser.me/api/portraits/men/7.jpg",
    clubId: "club1",
  },
  {
    id: "8",
    name: "Isabella Thomas",
    image: "https://randomuser.me/api/portraits/women/8.jpg",
    clubId: "club1",
  },
  {
    id: "9",
    name: "William Moore",
    image: "https://randomuser.me/api/portraits/men/9.jpg",
    clubId: "club2",
  },
  {
    id: "10",
    name: "Mia Jackson",
    image: "https://randomuser.me/api/portraits/women/10.jpg",
    clubId: "club2",
  },
  {
    id: "11",
    name: "Benjamin Harris",
    image: "https://randomuser.me/api/portraits/men/11.jpg",
    clubId: "club1",
  },
  {
    id: "12",
    name: "Charlotte Clark",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    clubId: "club1",
  },
  {
    id: "13",
    name: "Lucas Lewis",
    image: "https://randomuser.me/api/portraits/men/13.jpg",
    clubId: "club2",
  },
  {
    id: "14",
    name: "Amelia Walker",
    image: "https://randomuser.me/api/portraits/women/14.jpg",
    clubId: "club2",
  },
  {
    id: "15",
    name: "Henry Young",
    image: "https://randomuser.me/api/portraits/men/15.jpg",
    clubId: "club1",
  },
];

export default function SelectUserScreen() {
  const params = useGlobalSearchParams();
  const [users, setUsers] = useState<UserType[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string>("");
  const { stationId, stationName, stationShortName } = params;
  const { setUser } = useSelectedUser();

  // Load users from storage on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // Get logged-in user's session
      const sessionData = await AsyncStorage.getItem("userSession");
      if (!sessionData) {
        Alert.alert("Error", "No active session. Please login again.");
        router.replace("/login");
        return;
      }

      const session = JSON.parse(sessionData);
      const clubId = session.clubId;
      setUserClubId(clubId);
      setClubName(session.clubName || "");

      // Load stored users
      const storedUsers = await AsyncStorage.getItem(STORAGE_KEY);
      let allUsersList: UserType[] = [...INITIAL_USERS];

      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        // Merge stored users with initial users, removing duplicates
        allUsersList = [...parsed, ...INITIAL_USERS];
        const uniqueUsers = allUsersList.filter(
          (user, index, self) =>
            index === self.findIndex((u) => u.id === user.id),
        );
        allUsersList = uniqueUsers;
      }

      setAllUsers(allUsersList);

      // Filter users by club
      const filteredUsers = allUsersList.filter(
        (user) => user.clubId === clubId,
      );
      setUsers(filteredUsers);
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

  const addNewUser = useCallback(
    async (newUser: UserType) => {
      try {
        // Add clubId to new user
        const userWithClub = { ...newUser, clubId: userClubId || undefined };

        // Check if user already exists
        const exists = allUsers.some((u) => u.id === userWithClub.id);
        if (exists) {
          return;
        }

        const updatedAllUsers = [userWithClub, ...allUsers];
        setAllUsers(updatedAllUsers);

        // Only save the NEW users (not the initial ones) to AsyncStorage
        const newUsersOnly = updatedAllUsers.filter(
          (user) => !INITIAL_USERS.some((initial) => initial.id === user.id),
        );

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUsersOnly));

        // Update filtered users list
        const filteredUsers = updatedAllUsers.filter(
          (user) => user.clubId === userClubId,
        );
        setUsers(filteredUsers);
      } catch (error) {
        console.error("Error saving user:", error);
      }
    },
    [allUsers, userClubId],
  );

  // Handle new user addition
  useEffect(() => {
    if (params.newUser && !isLoading) {
      try {
        const newUser = JSON.parse(params.newUser as string);
        addNewUser(newUser);
      } catch (error) {
        console.error("Error parsing new user:", error);
      }
    }
  }, [params.newUser, isLoading, addNewUser]);

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
      {clubName && (
        <View style={styles.clubBadge}>
          <Ionicons name="business" size={16} color="#fff" />
          <Text style={styles.clubBadgeText}>{clubName}</Text>
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

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddUser}
        activeOpacity={0.8}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add New User</Text>
      </TouchableOpacity>

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
