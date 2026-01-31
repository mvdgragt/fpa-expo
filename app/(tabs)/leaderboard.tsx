import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

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
    topResults: TestResult[];
  };
}

export default function ResultsScreen() {
  const [groupedResults, setGroupedResults] = useState<GroupedResults>({});

  useEffect(() => {
    loadResults();

    // Refresh results every second to catch new ones
    const interval = setInterval(loadResults, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadResults = async () => {
    try {
      const savedResults = await AsyncStorage.getItem("testResults");
      if (savedResults) {
        const allResults: TestResult[] = JSON.parse(savedResults);

        // Group by station
        const grouped: GroupedResults = {};
        allResults.forEach((result) => {
          if (!grouped[result.stationId]) {
            grouped[result.stationId] = {
              stationName: result.stationName,
              stationShortName: result.stationShortName,
              topResults: [],
            };
          }
          grouped[result.stationId].topResults.push(result);
        });

        // Sort each station's results by time (best first) and keep top 3
        Object.keys(grouped).forEach((stationId) => {
          const results = grouped[stationId].topResults;

          // Keep best result per user
          const bestPerUser: { [userId: string]: TestResult } = {};

          results.forEach((result) => {
            const existing = bestPerUser[result.userId];

            if (
              !existing ||
              parseFloat(result.time) < parseFloat(existing.time)
            ) {
              bestPerUser[result.userId] = result;
            }
          });

          // Sort best results and keep top 3
          grouped[stationId].topResults = Object.values(bestPerUser)
            .sort((a, b) => parseFloat(a.time) - parseFloat(b.time))
            .slice(0, 3);
        });

        setGroupedResults(grouped);
      }
    } catch (error) {
      console.error("Error loading results:", error);
    }
  };

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

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 0:
        return "#FFD700"; // Gold
      case 1:
        return "#C0C0C0"; // Silver
      case 2:
        return "#CD7F32"; // Bronze
      default:
        return "#999";
    }
  };

  const getMedalIcon = (rank: number): "medal" => {
    return "medal";
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>Top 3 Results Per Station</Text>

      {Object.keys(groupedResults).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No results yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a test to see the leaderboard
          </Text>
        </View>
      ) : (
        Object.entries(groupedResults).map(([stationId, data]) => (
          <View key={stationId} style={styles.stationSection}>
            <View style={styles.stationHeader}>
              <Ionicons name="fitness" size={24} color="#007AFF" />
              <Text style={styles.stationTitle}>{data.stationShortName}</Text>
            </View>

            {data.topResults.map((result, index) => (
              <View
                key={`${result.userId}-${result.timestamp}-${index}`}
                style={[styles.resultCard, index === 0 && styles.firstPlace]}
              >
                <View style={styles.rankContainer}>
                  <Ionicons
                    name={getMedalIcon(index)}
                    size={32}
                    color={getMedalColor(index)}
                  />
                  <Text style={styles.rankNumber}>#{index + 1}</Text>
                </View>

                <Image
                  source={{ uri: result.userImage }}
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
        ))
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
  firstPlace: {
    backgroundColor: "#FFF9E6",
    borderColor: "#FFD700",
  },
  rankContainer: {
    alignItems: "center",
    marginRight: 12,
    minWidth: 50,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    marginTop: 2,
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
});
