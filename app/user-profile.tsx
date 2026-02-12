import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  extractUserPhotoObjectPath,
  getSignedUserPhotoUrl,
} from "../lib/user-photos";

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

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const {
    userId,
    userName,
    userImage,
    stationId,
    stationName,
    stationShortName,
  } = params;
  const [groupedResults, setGroupedResults] = useState<GroupedResults>({});
  const [imageError, setImageError] = useState(false);
  const [signedImageUrl, setSignedImageUrl] = useState("");
  const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp&f=y";

  useEffect(() => {
    const run = async () => {
      const raw = typeof userImage === "string" ? userImage : "";
      const path = extractUserPhotoObjectPath(raw);
      if (!path) {
        setSignedImageUrl("");
        return;
      }
      const url = await getSignedUserPhotoUrl(path);
      setSignedImageUrl(url);
    };
    run();
  }, [userImage]);

  useEffect(() => {
    const loadUserResults = async () => {
      try {
        const savedResults = await AsyncStorage.getItem("testResults");
        if (savedResults) {
          const allResults: TestResult[] = JSON.parse(savedResults);

          // Filter results for this user
          const userResults = allResults.filter((r) => r.userId === userId);

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

          // Sort each station's results by time (best first) and keep top 5
          Object.keys(grouped).forEach((stationId) => {
            grouped[stationId].results = grouped[stationId].results
              .sort((a, b) => parseFloat(a.time) - parseFloat(b.time))
              .slice(0, 5);
          });

          setGroupedResults(grouped);
        }
      } catch (error) {
        console.error("Error loading user results:", error);
      }
    };

    loadUserResults();
  }, [userId]);

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

  const handleStartTest = () => {
    // If coming from station selection, go directly to testing
    if (stationId) {
      router.push({
        pathname: "/(tabs)/testing",
        params: {
          userId,
          userName,
          userImage,
          stationId,
          stationName,
          stationShortName,
        },
      });
    } else {
      // Otherwise, go to station selection
      router.push("/");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Image
            source={{
              uri:
                !imageError && signedImageUrl
                  ? signedImageUrl
                  : defaultAvatarUrl,
            }}
            style={styles.profileImage}
            onError={() => setImageError(true)}
          />
          <Text style={styles.userName}>{userName}</Text>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleStartTest}
            activeOpacity={0.8}
          >
            <Ionicons name="play-circle" size={20} color="#fff" />
            <Text style={styles.testButtonText}>Start New Test</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Best Results</Text>

          {Object.keys(groupedResults).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No results yet</Text>
              <Text style={styles.emptySubtext}>
                Complete a test to see results here
              </Text>
            </View>
          ) : (
            Object.entries(groupedResults).map(([stationId, data]) => (
              <View key={stationId} style={styles.stationSection}>
                <Text style={styles.stationName}>{data.stationShortName}</Text>

                {data.results.map((result, index) => (
                  <View
                    key={`${result.timestamp}-${index}`}
                    style={styles.resultRow}
                  >
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.resultDetails}>
                      <Text style={styles.resultTime}>{result.time}s</Text>
                      <Text style={styles.resultDate}>
                        {formatDate(result.timestamp)}
                      </Text>
                    </View>
                    {index === 0 && (
                      <Ionicons name="trophy" size={24} color="#FFD700" />
                    )}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  testButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  testButtonText: {
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
  stationSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
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
  stationName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
  },
  resultDetails: {
    flex: 1,
  },
  resultTime: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 2,
  },
  resultDate: {
    fontSize: 12,
    color: "#999",
  },
  emptyState: {
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
