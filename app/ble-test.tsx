import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function BLETestScreen() {
  const [status, setStatus] = useState("Checking Bluetooth...");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    checkBluetooth();
  }, []);

  const addMessage = (msg: string) => {
    setMessages((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);
  };

  const checkBluetooth = async () => {
    if (Platform.OS === "web") {
      setStatus("Bluetooth not available on web");
      addMessage("Please run on a physical device");
      return;
    }

    setStatus("Ready to scan");
    addMessage("Bluetooth check complete");
    addMessage("Note: BLE requires development build (not Expo Go)");
  };

  const scanAndConnect = () => {
    Alert.alert(
      "BLE Setup Required",
      "To use Bluetooth, you need to:\n\n1. Run: npx expo prebuild --clean\n2. Run: npx expo run:android (or run:ios)\n\nExpo Go doesn't support BLE.",
      [{ text: "OK" }],
    );
    addMessage("BLE requires development build");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BLE Connection Test</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={scanAndConnect}>
        <Text style={styles.buttonText}>Scan & Connect</Text>
      </TouchableOpacity>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Log:</Text>
        <ScrollView style={styles.logScroll}>
          {messages.map((msg, index) => (
            <Text key={index} style={styles.logText}>
              {msg}
            </Text>
          ))}
        </ScrollView>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📱 To Enable BLE:</Text>
        <Text style={styles.infoText}>
          1. Stop Expo Go{"\n"}
          2. Run: npx expo prebuild --clean{"\n"}
          3. Run: npx expo run:android{"\n"}
          4. This creates a development build with native BLE support
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    marginTop: 60,
  },
  statusCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#007AFF",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: "#333",
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  infoBox: {
    backgroundColor: "#e3f2fd",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1565c0",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#1565c0",
    lineHeight: 20,
  },
});
