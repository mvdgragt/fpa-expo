import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { testStations } from "../constants/testStations";

export default function SelectStationScreen() {
  const handleStationSelect = (station: (typeof testStations)[0]) => {
    router.push({
      pathname: "/select-user",
      params: {
        stationId: station.id,
        stationName: station.name,
        stationShortName: station.shortName,
      },
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "speed":
        return "flash";
      case "agility":
        return "swap-horizontal";
      case "acceleration":
        return "rocket";
      default:
        return "fitness";
    }
  };

  const renderStation = ({ item }: { item: (typeof testStations)[0] }) => (
    <TouchableOpacity
      style={styles.stationCard}
      onPress={() => handleStationSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={getCategoryIcon(item.category)}
          size={48}
          color="#007AFF"
        />
      </View>
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{item.name}</Text>
        <Text style={styles.stationShortName}>{item.shortName}</Text>
        <Text style={styles.stationDescription}>{item.description}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Test Station</Text>
      <Text style={styles.subtitle}>Choose which test to perform</Text>

      <FlatList
        data={testStations}
        renderItem={renderStation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
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
    marginBottom: 24,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 20,
  },
  stationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  stationShortName: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 8,
  },
  stationDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
});
