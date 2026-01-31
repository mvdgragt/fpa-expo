import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useGlobalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelectedUser } from "../context/SelectedUserContext";

type UserType = (typeof INITIAL_USERS)[0];

const STORAGE_KEY = "@users_list";

const INITIAL_USERS = [
  {
    id: "1",
    name: "Alex Johnson",
    image: "https://randomuser.me/api/portraits/men/1.jpg",
  },
  {
    id: "2",
    name: "Sophia Martinez",
    image: "https://randomuser.me/api/portraits/women/2.jpg",
  },
  {
    id: "3",
    name: "Michael Brown",
    image: "https://randomuser.me/api/portraits/men/3.jpg",
  },
  {
    id: "4",
    name: "Emma Wilson",
    image: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    id: "5",
    name: "Daniel Lee",
    image: "https://randomuser.me/api/portraits/men/5.jpg",
  },
  {
    id: "6",
    name: "Olivia Taylor",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
  },
  {
    id: "7",
    name: "James Anderson",
    image: "https://randomuser.me/api/portraits/men/7.jpg",
  },
  {
    id: "8",
    name: "Isabella Thomas",
    image: "https://randomuser.me/api/portraits/women/8.jpg",
  },
  {
    id: "9",
    name: "William Moore",
    image: "https://randomuser.me/api/portraits/men/9.jpg",
  },
  {
    id: "10",
    name: "Mia Jackson",
    image: "https://randomuser.me/api/portraits/women/10.jpg",
  },
  {
    id: "11",
    name: "Benjamin Harris",
    image: "https://randomuser.me/api/portraits/men/11.jpg",
  },
  {
    id: "12",
    name: "Charlotte Clark",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  {
    id: "13",
    name: "Lucas Lewis",
    image: "https://randomuser.me/api/portraits/men/13.jpg",
  },
  {
    id: "14",
    name: "Amelia Walker",
    image: "https://randomuser.me/api/portraits/women/14.jpg",
  },
  {
    id: "15",
    name: "Henry Young",
    image: "https://randomuser.me/api/portraits/men/15.jpg",
  },
];

export default function SelectUserScreen() {
  const params = useGlobalSearchParams();
  const [users, setUsers] = useState<UserType[]>(INITIAL_USERS);
  const [isLoading, setIsLoading] = useState(true);
  const { stationId, stationName, stationShortName } = params;
  const { setUser } = useSelectedUser();

  // Load users from storage on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const storedUsers = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        // Merge stored users with initial users, removing duplicates
        const allUsers = [...parsed, ...INITIAL_USERS];
        const uniqueUsers = allUsers.filter(
          (user, index, self) =>
            index === self.findIndex((u) => u.id === user.id),
        );
        setUsers(uniqueUsers);
      } else {
        // No stored users, use initial users
        setUsers(INITIAL_USERS);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers(INITIAL_USERS);
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
        // Check if user already exists
        const exists = users.some((u) => u.id === newUser.id);
        if (exists) {
          // User already added, just select them
          // handleUserSelect(newUser);
          return;
        }

        const updatedUsers = [newUser, ...users];

        // Only save the NEW users (not the initial ones) to AsyncStorage
        const newUsersOnly = updatedUsers.filter(
          (user) => !INITIAL_USERS.some((initial) => initial.id === user.id),
        );

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUsersOnly));
        setUsers(updatedUsers);

        // Auto-select the newly added user
        // handleUserSelect(newUser);
      } catch (error) {
        console.error("Error saving user:", error);
      }
    },
    [users],
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

  const renderUser = ({ item }: { item: (typeof INITIAL_USERS)[0] }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserSelect(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.image }} style={styles.userImage} />
      <Text style={styles.userName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {stationShortName && (
        <View style={styles.stationBadge}>
          <Text style={styles.stationBadgeText}>
            Testing: {stationShortName}
          </Text>
        </View>
      )}

      <Text style={styles.title}>Select a User</Text>
      <Text style={styles.subtitle}>Choose who you want to test</Text>

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddUser}
        activeOpacity={0.8}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add New User</Text>
      </TouchableOpacity>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
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
  stationBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
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
