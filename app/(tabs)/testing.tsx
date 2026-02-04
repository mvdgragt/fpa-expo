import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useGlobalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BLEStatusBar } from "../../components/BLEStatusBar";
import { useBLE } from "../../context/BLEContext";
import { useSelectedUser } from "../../context/SelectedUserContext";

export default function TestingScreen() {
  const { isConnected } = useBLE();
  const params = useGlobalSearchParams();
  const { user } = useSelectedUser();
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const { stationId, stationName, stationShortName } = params;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const previousStationId = useRef(stationId);

  // Detect station change and trigger animation
  useEffect(() => {
    if (
      previousStationId.current !== stationId &&
      previousStationId.current !== undefined
    ) {
      // Station changed - trigger animation
      Animated.sequence([
        // Fade out and scale down
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // Fade in and scale up
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
    previousStationId.current = stationId;
  }, [stationId, fadeAnim, scaleAnim]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 10);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = () => {
    setIsRunning(true);
    setHasStarted(true);
  };

  const handleStop = async () => {
    setIsRunning(false);
    const finalTime = (time / 1000).toFixed(2);

    // Save result
    try {
      const result = {
        userId: user?.id || "unknown",
        userName: user?.name || "Unknown User",
        userImage: user?.image || "",
        stationId: stationId as string,
        stationName: stationName as string,
        stationShortName: stationShortName as string,
        time: finalTime,
        timestamp: new Date().toISOString(),
      };

      const savedResults = await AsyncStorage.getItem("testResults");
      const results = savedResults ? JSON.parse(savedResults) : [];
      results.push(result);
      await AsyncStorage.setItem("testResults", JSON.stringify(results));

      Alert.alert(
        "Test Complete!",
        `Time: ${finalTime}s\n\nResult saved successfully!`,
        [
          {
            text: "New Test",
            onPress: () => {
              setTime(0);
              setHasStarted(false);
            },
          },
          {
            text: "View Results",
            onPress: () => router.push("/user-results"),
          },
        ],
      );
    } catch (error) {
      console.error("Error saving result:", error);
      Alert.alert("Error", "Failed to save result");
    }
  };

  const handleReset = () => {
    if (isRunning) return; // Prevent reset while running
    setIsRunning(false);
    setTime(0);
    setHasStarted(false);
  };

  const handleChangeUser = () => {
    if (isRunning) return; // Prevent change while running
    router.push({
      pathname: "/select-user",
      params: {
        stationId,
        stationName,
        stationShortName,
      },
    });
  };

  const handleChangeStation = () => {
    if (isRunning) return; // Prevent change while running
    // Navigate to stations with a flag to return to testing
    router.push({
      pathname: "/(tabs)/stations",
      params: {
        returnToTesting: "true",
      },
    });
  };

  const handleSelectStation = () => {
    router.push("/(tabs)/stations");
  };

  const handleSelectUser = () => {
    if (!stationId) {
      Alert.alert(
        "Select Station First",
        "Please select a station before choosing a user.",
      );
      return;
    }
    router.push({
      pathname: "/select-user",
      params: {
        stationId,
        stationName,
        stationShortName,
      },
    });
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Show setup screen if user or station is not selected
  if (!user || !stationId) {
    return (
      <View style={styles.container}>
        <BLEStatusBar />
        {!isConnected && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Please connect to your sensor first
            </Text>
          </View>
        )}
        <View style={styles.setupContainer}>
          <Ionicons name="timer-outline" size={80} color="#007AFF" />
          <Text style={styles.setupTitle}>Ready to Test?</Text>
          <Text style={styles.setupSubtitle}>
            Select a station and user to begin testing
          </Text>

          <View style={styles.setupButtonsContainer}>
            {!stationId ? (
              <TouchableOpacity
                style={styles.setupButton}
                onPress={handleSelectStation}
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={24} color="#fff" />
                <Text style={styles.setupButtonText}>Select Station</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.selectedBadgeText}>{stationShortName}</Text>
              </View>
            )}

            {!user ? (
              <TouchableOpacity
                style={[
                  styles.setupButton,
                  !stationId && styles.setupButtonDisabled,
                ]}
                onPress={handleSelectUser}
                activeOpacity={0.8}
                disabled={!stationId}
              >
                <Ionicons
                  name="person"
                  size={24}
                  color={!stationId ? "#999" : "#fff"}
                />
                <Text
                  style={[
                    styles.setupButtonText,
                    !stationId && styles.setupButtonTextDisabled,
                  ]}
                >
                  Select User
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.selectedBadgeText}>{user.name}</Text>
              </View>
            )}
          </View>

          {!stationId && (
            <Text style={styles.setupHint}>
              💡 Start by selecting a station from the Stations tab
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Station Info with Animation */}
      {stationShortName && (
        <Animated.View
          style={[
            styles.stationBadge,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons name="fitness" size={20} color="#fff" />
          <Text style={styles.stationBadgeText}>{stationShortName}</Text>
        </Animated.View>
      )}

      {/* User Info with Change Buttons */}
      {user && (
        <View style={styles.userInfo}>
          <Image source={{ uri: user.image }} style={styles.userImage} />
          <Text style={styles.userName}>{user.name}</Text>

          <View style={styles.changeButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.changeButton,
                isRunning && styles.changeButtonDisabled,
              ]}
              onPress={handleChangeUser}
              activeOpacity={isRunning ? 1 : 0.8}
              disabled={isRunning}
            >
              <Ionicons
                name="swap-horizontal"
                size={20}
                color={isRunning ? "#999" : "#007AFF"}
              />
              <Text
                style={[
                  styles.changeButtonText,
                  isRunning && styles.changeButtonTextDisabled,
                ]}
              >
                Change User
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.changeButton,
                isRunning && styles.changeButtonDisabled,
              ]}
              onPress={handleChangeStation}
              activeOpacity={isRunning ? 1 : 0.8}
              disabled={isRunning}
            >
              <Ionicons
                name="location"
                size={20}
                color={isRunning ? "#999" : "#007AFF"}
              />
              <Text
                style={[
                  styles.changeButtonText,
                  isRunning && styles.changeButtonTextDisabled,
                ]}
              >
                Change Station
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Timer Display */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(time)}</Text>
      </View>

      {/* Control Buttons */}
      <View style={styles.buttonContainer}>
        {!hasStarted ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={handleStart}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={32} color="#fff" />
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <>
            {isRunning ? (
              <TouchableOpacity
                style={[styles.button, styles.stopButton]}
                onPress={handleStop}
                activeOpacity={0.8}
              >
                <Ionicons name="stop" size={32} color="#fff" />
                <Text style={styles.buttonText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.startButton]}
                onPress={handleStart}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={32} color="#fff" />
                <Text style={styles.buttonText}>Resume</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                styles.resetButton,
                isRunning && styles.resetButtonDisabled,
              ]}
              onPress={handleReset}
              activeOpacity={isRunning ? 1 : 0.8}
              disabled={isRunning}
            >
              <Ionicons name="refresh" size={32} color="#fff" />
              <Text style={styles.buttonText}>Reset</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  warningBox: {
    backgroundColor: "#ff5555",
    padding: 16,
    margin: 20,
    borderRadius: 12,
  },
  warningText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  setupContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    maxWidth: 400,
  },
  setupTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  setupSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  setupButtonsContainer: {
    width: "100%",
    gap: 16,
  },
  setupButton: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  setupButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.5,
  },
  setupButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  setupButtonTextDisabled: {
    color: "#999",
  },
  selectedBadge: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  selectedBadgeText: {
    color: "#2E7D32",
    fontSize: 18,
    fontWeight: "600",
  },
  setupHint: {
    fontSize: 14,
    color: "#666",
    marginTop: 24,
    textAlign: "center",
    fontStyle: "italic",
  },
  stationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 30,
    gap: 8,
  },
  stationBadgeText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  userInfo: {
    alignItems: "center",
    marginBottom: 40,
  },
  userImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 4,
    borderColor: "#007AFF",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  changeButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  changeButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  changeButtonDisabled: {
    backgroundColor: "#f0f0f0",
    borderColor: "#ccc",
    opacity: 0.5,
  },
  changeButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  changeButtonTextDisabled: {
    color: "#999",
  },
  timerContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 40,
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    minWidth: 300,
    alignItems: "center",
  },
  timerText: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#1a1a1a",
    fontVariant: ["tabular-nums"],
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 40,
  },
  button: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  resetButton: {
    backgroundColor: "#FF9800",
  },
  resetButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
});
