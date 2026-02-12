import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelectedUser } from "../../context/SelectedUserContext";
import {
  extractUserPhotoObjectPath,
  getSignedUserPhotoUrl,
} from "../../lib/user-photos";

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
    results: TestResult[];
  };
}

export default function UserResultsScreen() {
  const { user } = useSelectedUser();
  const [groupedResults, setGroupedResults] = useState<GroupedResults>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp&f=y";

  const loadUserResults = useCallback(async () => {
    try {
      const savedResults = await AsyncStorage.getItem("testResults");
      if (savedResults && user) {
        const allResults: TestResult[] = JSON.parse(savedResults);

        try {
          const unique = Array.from(
            new Set(
              allResults.map((r) => String(r.userImage || "")).filter(Boolean),
            ),
          );
          const entries = await Promise.all(
            unique.map(async (raw) => {
              const path = extractUserPhotoObjectPath(raw);
              const url = path ? await getSignedUserPhotoUrl(path) : "";
              return [raw, url] as const;
            }),
          );
          setSignedUrls((prev) => {
            const next = { ...prev };
            for (const [raw, url] of entries) {
              if (url) next[raw] = url;
            }
            return next;
          });
        } catch {
          // ignore
        }

        // Filter results for current user and get latest 5
        const userResults = allResults
          .filter((result) => result.userId === user.id)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
          .slice(0, 5);

        // Group by station
        const grouped: GroupedResults = {};
        userResults.forEach((result) => {
          if (!grouped[result.stationId]) {
            grouped[result.stationId] = {
              stationName: result.stationName,
              stationShortName: result.stationShortName,
              results: [],
            };
          }
          grouped[result.stationId].results.push(result);
        });

        setGroupedResults(grouped);
      } else {
        setGroupedResults({});
      }
    } catch (error) {
      console.error("Error loading user results:", error);
    }
  }, [user]);

  useEffect(() => {
    loadUserResults();
  }, [loadUserResults]);

  useFocusEffect(
    useCallback(() => {
      loadUserResults();
    }, [loadUserResults]),
  );

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return `${dateStr}, ${timeStr}`;
  };

  const handleViewLeaderboard = () => {
    router.push("/(tabs)/leaderboard");
  };

  const handleNewTest = () => {
    router.push("/");
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{user?.name || "Your Results"}</Text>
      <Text style={styles.subtitle}>Your Latest 5 Results</Text>

      {Object.keys(groupedResults).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No results yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a test to see your results here
          </Text>
        </View>
      ) : (
        <>
          {Object.entries(groupedResults).map(([stationId, data]) => (
            <View key={stationId} style={styles.stationSection}>
              <View style={styles.stationHeader}>
                <Ionicons name="fitness" size={24} color="#007AFF" />
                <Text style={styles.stationTitle}>{data.stationShortName}</Text>
              </View>

              {data.results.map((result, index) => (
                <View
                  key={`${result.userId}-${result.timestamp}-${index}`}
                  style={styles.resultCard}
                >
                  <Image
                    source={{
                      uri: signedUrls[result.userImage] || defaultAvatarUrl,
                    }}
                    style={styles.resultUserImage}
                  />

                  <View style={styles.resultInfo}>
                    <Text style={styles.resultUserName}>{result.userName}</Text>
                    <Text style={styles.resultDate}>
                      {formatDate(result.timestamp)}
                    </Text>
                  </View>

                  <View style={styles.timeContainer}>
                    <Text style={styles.resultTime}>{result.time}s</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.leaderboardButton]}
              onPress={handleViewLeaderboard}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>View Leaderboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.newTestButton]}
              onPress={handleNewTest}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>New Test</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 20,
    paddingHorizontal: 16,
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
    marginBottom: 20,
    textAlign: "center",
  },
  stationSection: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
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
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#007AFF",
  },
  stationTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  resultCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  resultUserImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultUserName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  resultDate: {
    fontSize: 12,
    color: "#999",
  },
  timeContainer: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resultTime: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#999",
  },
  actionButtons: {
    gap: 12,
    paddingBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  leaderboardButton: {
    backgroundColor: "#47464c",
  },
  newTestButton: {
    backgroundColor: "#4CAF50",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
