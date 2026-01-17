import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, View } from "react-native";

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

export default function ResultsScreen() {
  const [results, setResults] = useState<TestResult[]>([]);

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
        const parsedResults = JSON.parse(savedResults);
        setResults([...parsedResults].reverse()); // Show newest first
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

  const renderResult = ({ item }: { item: TestResult }) => (
    <View style={styles.resultCard}>
      <Image source={{ uri: item.userImage }} style={styles.resultUserImage} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultUserName}>{item.userName}</Text>
        <Text style={styles.resultStation}>{item.stationShortName}</Text>
        <Text style={styles.resultTime}>{item.time}s</Text>
        <Text style={styles.resultDate}>{formatDate(item.timestamp)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Results</Text>

      {results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item, index) =>
            `${item.userId}-${item.timestamp}-${index}`
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a test to see results here
          </Text>
        </View>
      )}
    </View>
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
    marginBottom: 20,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
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
  resultUserImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  resultInfo: {
    flex: 1,
  },
  resultUserName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  resultStation: {
    fontSize: 14,
    color: "#007AFF",
    marginBottom: 4,
  },
  resultTime: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 4,
  },
  resultDate: {
    fontSize: 12,
    color: "#999",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#999",
  },
});
