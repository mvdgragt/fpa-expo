import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TestResult = {
  userId: string;
  userName: string;
  userImage: string;
  stationId: string;
  stationName: string;
  stationShortName: string;
  time: string;
  timestamp: string;
};

type StationBenchmark = {
  stationId: string;
  stationName: string;
  stationShortName: string;
  results: {
    userName: string;
    userId: string;
    time: string;
    timestamp: string;
  }[];
};

export default function BenchmarkScreen() {
  const [benchmarks, setBenchmarks] = useState<StationBenchmark[]>([]);
  const [filteredBenchmarks, setFilteredBenchmarks] = useState<
    StationBenchmark[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [availableStations, setAvailableStations] = useState<
    { id: string; name: string }[]
  >([]);
  const [availableUsers, setAvailableUsers] = useState<
    { id: string; name: string }[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      loadBenchmarks();
    }, []),
  );

  const loadBenchmarks = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedResults = await AsyncStorage.getItem("testResults");
      if (!savedResults) {
        setBenchmarks([]);
        setFilteredBenchmarks([]);
        return;
      }

      const results: TestResult[] = JSON.parse(savedResults);

      // Extract unique stations and users for filters
      const stationsSet = new Set<string>();
      const usersMap = new Map<string, string>();

      results.forEach((result) => {
        stationsSet.add(result.stationId);
        usersMap.set(result.userId, result.userName);
      });

      setAvailableStations(
        Array.from(stationsSet).map((id) => {
          const result = results.find((r) => r.stationId === id);
          return {
            id,
            name: result?.stationShortName || result?.stationName || id,
          };
        }),
      );

      setAvailableUsers(
        Array.from(usersMap.entries()).map(([id, name]) => ({ id, name })),
      );

      // Group results by station
      const stationMap = new Map<string, StationBenchmark>();

      results.forEach((result) => {
        if (!stationMap.has(result.stationId)) {
          stationMap.set(result.stationId, {
            stationId: result.stationId,
            stationName: result.stationName,
            stationShortName: result.stationShortName,
            results: [],
          });
        }

        stationMap.get(result.stationId)?.results.push({
          userName: result.userName,
          userId: result.userId,
          time: result.time,
          timestamp: result.timestamp,
        });
      });

      // Sort results within each station by time (fastest first)
      stationMap.forEach((station) => {
        station.results.sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
      });

      const allBenchmarks = Array.from(stationMap.values());
      setBenchmarks(allBenchmarks);
      applyFilters(allBenchmarks, selectedStation, selectedUser);
    } catch (error) {
      console.error("Error loading benchmarks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStation, selectedUser]);

  const applyFilters = (
    data: StationBenchmark[],
    stationFilter: string | null,
    userFilter: string | null,
  ) => {
    let filtered = [...data];

    // Filter by station
    if (stationFilter) {
      filtered = filtered.filter(
        (station) => station.stationId === stationFilter,
      );
    }

    // Filter by user
    if (userFilter) {
      filtered = filtered
        .map((station) => ({
          ...station,
          results: station.results.filter(
            (result) => result.userId === userFilter,
          ),
        }))
        .filter((station) => station.results.length > 0);
    }

    setFilteredBenchmarks(filtered);
  };

  const handleStationFilter = (stationId: string | null) => {
    setSelectedStation(stationId);
    applyFilters(benchmarks, stationId, selectedUser);
  };

  const handleUserFilter = (userId: string | null) => {
    setSelectedUser(userId);
    applyFilters(benchmarks, selectedStation, userId);
  };

  const handleClearFilters = () => {
    setSelectedStation(null);
    setSelectedUser(null);
    applyFilters(benchmarks, null, null);
    setFilterModalVisible(false);
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Results",
      "Are you sure you want to delete all test results? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("testResults");
              setBenchmarks([]);
              setFilteredBenchmarks([]);
              setSelectedStation(null);
              setSelectedUser(null);
              Alert.alert("Success", "All results have been cleared");
            } catch (error) {
              console.error("Error clearing results:", error);
              Alert.alert("Error", "Failed to clear results");
            }
          },
        },
      ],
    );
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "#FFD700"; // Gold
      case 1:
        return "#C0C0C0"; // Silver
      case 2:
        return "#CD7F32"; // Bronze
      default:
        return "#E0E0E0"; // Default
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return "trophy";
      case 1:
        return "medal";
      case 2:
        return "medal";
      default:
        return "ribbon";
    }
  };

  const activeFiltersCount = (selectedStation ? 1 : 0) + (selectedUser ? 1 : 0);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading benchmarks...</Text>
        </View>
      </View>
    );
  }

  if (benchmarks.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="bar-chart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Results Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete some tests to see benchmarks here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Benchmark Results</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="filter" size={20} color="#007AFF" />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>

      {activeFiltersCount > 0 && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersLabel}>Active Filters:</Text>
          {selectedStation && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {availableStations.find((s) => s.id === selectedStation)?.name}
              </Text>
              <TouchableOpacity onPress={() => handleStationFilter(null)}>
                <Ionicons name="close-circle" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}
          {selectedUser && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {availableUsers.find((u) => u.id === selectedUser)?.name}
              </Text>
              <TouchableOpacity onPress={() => handleUserFilter(null)}>
                <Ionicons name="close-circle" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredBenchmarks.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={60} color="#ccc" />
            <Text style={styles.noResultsText}>
              No results match your filters
            </Text>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredBenchmarks.map((station) => (
            <View key={station.stationId} style={styles.stationCard}>
              <View style={styles.stationHeader}>
                <Ionicons name="fitness" size={24} color="#007AFF" />
                <Text style={styles.stationName}>
                  {station.stationShortName}
                </Text>
                <Text style={styles.resultCount}>
                  {station.results.length} result
                  {station.results.length !== 1 ? "s" : ""}
                </Text>
              </View>

              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.rankColumn]}>
                    Rank
                  </Text>
                  <Text style={[styles.tableHeaderText, styles.nameColumn]}>
                    User
                  </Text>
                  <Text style={[styles.tableHeaderText, styles.timeColumn]}>
                    Time
                  </Text>
                </View>

                {/* Table Rows */}
                {station.results.map((result, index) => (
                  <View
                    key={`${result.userName}-${result.timestamp}`}
                    style={[
                      styles.tableRow,
                      index % 2 === 0 && styles.tableRowEven,
                    ]}
                  >
                    <View style={styles.rankColumn}>
                      <Ionicons
                        name={getRankIcon(index)}
                        size={20}
                        color={getRankColor(index)}
                      />
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.nameColumn]}>
                      {result.userName}
                    </Text>
                    <View style={{ width: 80 }}>
                      <Text style={[styles.timeText, styles.timeColumn]}>
                        {result.time}s
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Results</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Station Filter */}
              <Text style={styles.filterSectionTitle}>By Station</Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedStation === null && styles.filterOptionSelected,
                ]}
                onPress={() => handleStationFilter(null)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedStation === null && styles.filterOptionTextSelected,
                  ]}
                >
                  All Stations
                </Text>
                {selectedStation === null && (
                  <Ionicons name="checkmark" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
              {availableStations.map((station) => (
                <TouchableOpacity
                  key={station.id}
                  style={[
                    styles.filterOption,
                    selectedStation === station.id &&
                      styles.filterOptionSelected,
                  ]}
                  onPress={() => handleStationFilter(station.id)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedStation === station.id &&
                        styles.filterOptionTextSelected,
                    ]}
                  >
                    {station.name}
                  </Text>
                  {selectedStation === station.id && (
                    <Ionicons name="checkmark" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}

              {/* User Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: 24 }]}>
                By User
              </Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedUser === null && styles.filterOptionSelected,
                ]}
                onPress={() => handleUserFilter(null)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedUser === null && styles.filterOptionTextSelected,
                  ]}
                >
                  All Users
                </Text>
                {selectedUser === null && (
                  <Ionicons name="checkmark" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
              {availableUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.filterOption,
                    selectedUser === user.id && styles.filterOptionSelected,
                  ]}
                  onPress={() => handleUserFilter(user.id)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedUser === user.id &&
                        styles.filterOptionTextSelected,
                    ]}
                  >
                    {user.name}
                  </Text>
                  {selectedUser === user.id && (
                    <Ionicons name="checkmark" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearFiltersModalButton}
                onPress={handleClearFilters}
              >
                <Text style={styles.clearFiltersModalButtonText}>
                  Clear All Filters
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  filterButton: {
    position: "relative",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  filterBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#F44336",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  clearButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F44336",
  },
  activeFiltersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  activeFiltersLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    color: "#666",
    marginTop: 16,
    marginBottom: 24,
  },
  clearFiltersButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  stationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
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
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  stationName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginLeft: 8,
    flex: 1,
  },
  resultCount: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tableRowEven: {
    backgroundColor: "#f8f9fa",
  },
  tableCell: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  rankColumn: {
    width: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  nameColumn: {
    flex: 1,
    fontWeight: "500",
  },
  timeColumn: {
    textAlign: "right",
  },
  timeText: {
    fontWeight: "bold",
    color: "#007AFF",
    fontVariant: ["tabular-nums"],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  modalScroll: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 16,
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f8f9fa",
  },
  filterOptionSelected: {
    backgroundColor: "#E3F2FD",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  filterOptionText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  filterOptionTextSelected: {
    fontWeight: "600",
    color: "#007AFF",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  clearFiltersModalButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  clearFiltersModalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  applyButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
