import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelectedUser } from "../../context/SelectedUserContext";

interface TestResult {
  userId: string;
  userName: string;
  userImage: string;
  stationId: string;
  stationName: string;
  stationShortName: string;
  time: string;
  timestamp: string;
}

interface GroupedResults {
  [stationId: string]: {
    stationName: string;
    stationShortName: string;
    bestResult: TestResult;
  };
}

export default function ProfilesScreen() {
  const { user } = useSelectedUser();
  const [groupedResults, setGroupedResults] = useState<GroupedResults>({});

  useEffect(() => {
    const loadUserResults = async () => {
      if (!user?.id) return;

      try {
        const savedResults = await AsyncStorage.getItem("testResults");
        if (savedResults) {
          const allResults: TestResult[] = JSON.parse(savedResults);

          // Filter results for this user
          const userResults = allResults.filter((r) => r.userId === user.id);

          // Group by station and keep only the best result
          const grouped: GroupedResults = {};
          userResults.forEach((result) => {
            if (!grouped[result.stationId]) {
              grouped[result.stationId] = {
                stationName: result.stationName,
                stationShortName: result.stationShortName,
                bestResult: result,
              };
            } else {
              // Update if this result is better (lower time)
              if (
                parseFloat(result.time) <
                parseFloat(grouped[result.stationId].bestResult.time)
              ) {
                grouped[result.stationId].bestResult = result;
              }
            }
          });

          setGroupedResults(grouped);
        }
      } catch (error) {
        console.error("Error loading user results:", error);
      }
    };

    if (user?.id) {
      loadUserResults();
    }
  }, [user?.id]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "Today";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleSelectUser = () => {
    router.push("/select-user");
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No user selected</Text>
          <Text style={styles.emptySubtext}>
            Select a user to view their profile
          </Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={handleSelectUser}
            activeOpacity={0.8}
          >
            <Text style={styles.selectButtonText}>Select User</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: user.image }} style={styles.profileImage} />
        <Text style={styles.userName}>{user.name}</Text>

        <TouchableOpacity
          style={styles.changeUserButton}
          onPress={handleSelectUser}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-horizontal" size={20} color="#007AFF" />
          <Text style={styles.changeUserButtonText}>Change User</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.sectionTitle}>Best Results</Text>

        {Object.keys(groupedResults).length === 0 ? (
          <View style={styles.emptyResultsState}>
            <Ionicons name="analytics-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No results yet</Text>
            <Text style={styles.emptySubtext}>
              Complete a test to see results here
            </Text>
          </View>
        ) : (
          Object.entries(groupedResults).map(([stationId, data]) => (
            <View key={stationId} style={styles.stationCard}>
              <View style={styles.stationHeader}>
                <Text style={styles.stationName}>{data.stationShortName}</Text>
                <Ionicons name="trophy" size={24} color="#FFD700" />
              </View>
              <View style={styles.resultContent}>
                <Text style={styles.resultTime}>{data.bestResult.time}s</Text>
                <Text style={styles.resultDate}>
                  {formatDate(data.bestResult.timestamp)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 24,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: "#007AFF",
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  changeUserButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  changeUserButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  selectButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  stationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stationName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  resultContent: {
    alignItems: "center",
    paddingVertical: 8,
  },
  resultTime: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 4,
  },
  resultDate: {
    fontSize: 14,
    color: "#999",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyResultsState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#ccc",
  },
});
