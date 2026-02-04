import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useBLE } from "../context/BLEContext";

export function BLEStatusBar() {
  const { isConnected, deviceName } = useBLE();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isConnected ? styles.connected : styles.disconnected,
      ]}
      onPress={() => router.push("/ble-test")}
    >
      <Ionicons
        name={isConnected ? "bluetooth" : "bluetooth-outline"}
        size={20}
        color="#fff"
      />
      <Text style={styles.text}>
        {isConnected
          ? `Connected: ${deviceName}`
          : "Not Connected - Tap to Connect"}
      </Text>
      {!isConnected && <Ionicons name="warning" size={20} color="#fff" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  connected: {
    backgroundColor: "#00c896",
  },
  disconnected: {
    backgroundColor: "#ff5555",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
