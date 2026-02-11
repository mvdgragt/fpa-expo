// app/testing.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useGlobalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBle } from "../../context/BLEContext"; // Import the BLE hook
import { useSelectedUser } from "../../context/SelectedUserContext";

export default function TestingScreen() {
  const params = useGlobalSearchParams();
  const { user } = useSelectedUser();
  const {
    connectedDevice,
    isConnecting,
    distance,
    hubDistance,
    remoteDistance,
  } = useBle(); // Use global BLE state
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [buttonText, setButtonText] = useState("waiting");
  const [isFinished, setIsFinished] = useState(false);
  const [lapTime, setLapTime] = useState<number | null>(null);

  const { stationId, stationName, stationShortName } = params;
  const startTimeRef = useRef<number | null>(null);
  const wasReady = useRef(false);
  const stopGateReady = useRef(false); // true once remote sensor sees > 150 (no one there)
  const stopPassCount = useRef(0);
  const stopGateArmed = useRef(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const previousStationId = useRef(stationId);

  const handleStart = useCallback(() => {
    setIsRunning(true);
    setHasStarted(true);
    startTimeRef.current = Date.now();
    stopGateReady.current = false;
  }, []);

  const handleStop = useCallback(async () => {
    const elapsedMs = startTimeRef.current
      ? Date.now() - startTimeRef.current
      : time;
    setIsRunning(false);
    setIsFinished(true);
    setTime(elapsedMs);
    const finalTime = (elapsedMs / 1000).toFixed(2);

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
    } catch (error) {
      console.error("Error saving result:", error);
      Alert.alert("Error", "Failed to save result");
    }
  }, [
    stationId,
    stationName,
    stationShortName,
    time,
    user?.id,
    user?.image,
    user?.name,
  ]);

  const isFiveTenFive = stationId === "five-ten-five";
  const isRemoteStopStation =
    stationId === "flying-20" ||
    stationId === "ten-meter-sprint" ||
    stationId === "twenty-meter-sprint" ||
    stationId === "skill-test";

  // START gate logic — hub sensor detects athlete
  useEffect(() => {
    const d = hubDistance ?? distance;
    if (d === undefined || d === null) {
      if (!hasStarted) setButtonText("waiting");
      return;
    }

    if (!hasStarted && !isRunning) {
      if (d <= 150) {
        // Athlete is in position at start gate
        wasReady.current = true;
        setButtonText("ready");
      } else if (wasReady.current) {
        // Was ready, now moved away → auto-start timer
        wasReady.current = false;
        handleStart();
        setButtonText("running");
      } else {
        setButtonText("waiting");
      }
    } else if (isRunning && !isRemoteStopStation) {
      // For non-flying-twenty stations, hub is also the stop gate
      if (isFiveTenFive) {
        if (d > 150) {
          // Gate is clear — arm it
          stopGateArmed.current = true;
        } else if (stopGateArmed.current && d <= 150) {
          // Athlete passed the gate
          stopGateArmed.current = false;
          stopPassCount.current += 1;

          const elapsedMs = startTimeRef.current
            ? Date.now() - startTimeRef.current
            : time;

          if (stopPassCount.current === 1) {
            setLapTime(elapsedMs);
          } else if (stopPassCount.current >= 2) {
            handleStop();
          }
        }
      } else {
        if (d <= 150) {
          handleStop();
        }
      }
    }
  }, [
    hubDistance,
    distance,
    handleStart,
    handleStop,
    hasStarted,
    isRunning,
    isRemoteStopStation,
    isFiveTenFive,
    time,
  ]);

  // STOP gate logic — remote sensor (second ESP32) for stations that stop remotely
  // Requires a state transition: sensor must see > 150 (clear) first,
  // then ≤ 150 (athlete passing) to trigger stop.
  // remoteDistance of 0 is ignored (sensor error / no data from ESP-NOW yet).
  useEffect(() => {
    if (!isRemoteStopStation) return;
    if (!isRunning || remoteDistance === null || remoteDistance === 0) return;

    if (remoteDistance > 150) {
      // Stop gate is clear — arm it
      stopGateReady.current = true;
    } else if (stopGateReady.current && remoteDistance <= 150) {
      // Athlete passed stop gate → auto-stop timer
      handleStop();
    }
  }, [remoteDistance, handleStop, isRunning, isRemoteStopStation]);

  // Detect station change and trigger animation
  useEffect(() => {
    if (
      previousStationId.current !== stationId &&
      previousStationId.current !== undefined
    ) {
      setIsRunning(false);
      setTime(0);
      setHasStarted(false);
      setIsFinished(false);
      setLapTime(null);
      startTimeRef.current = null;
      wasReady.current = false;
      stopGateReady.current = false;
      stopPassCount.current = 0;
      stopGateArmed.current = false;

      Animated.sequence([
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
    if (isRunning && startTimeRef.current !== null) {
      interval = setInterval(() => {
        setTime(Date.now() - startTimeRef.current!);
      }, 16);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleReset = () => {
    if (isRunning) return;
    setIsRunning(false);
    setTime(0);
    setHasStarted(false);
    setIsFinished(false);
    setLapTime(null);
    startTimeRef.current = null;
    wasReady.current = false;
    stopGateReady.current = false;
    stopPassCount.current = 0;
    stopGateArmed.current = false;
  };

  const handleChangeUser = () => {
    if (isRunning) return;
    router.push({
      pathname: "/(tabs)/select-user" as any,
      params: {
        stationId,
        stationName,
        stationShortName,
      },
    });
  };

  const handleChangeStation = () => {
    if (isRunning) return;
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
    if (isRunning) {
      Alert.alert("Cannot change user", "Stop the current session first");
      return;
    }
    router.push({
      pathname: "/(tabs)/select-user" as any,
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
      <SafeAreaView style={styles.container}>
        {/* Connecting Modal */}
        {isConnecting && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Ionicons
                name="bluetooth"
                size={32}
                color="#007AFF"
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.modalText}>Connecting to FPA HUB</Text>
            </View>
          </View>
        )}

        {/* Connected Pill */}
        {connectedDevice && (
          <View style={styles.connectedContainer}>
            <View style={styles.connectedPill}>
              <View style={styles.statusDot} />
              <Text style={styles.connectedPillText}>
                {connectedDevice.name} Linked
              </Text>
            </View>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Connecting Modal */}
      {isConnecting && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons
              name="bluetooth"
              size={32}
              color="#007AFF"
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.modalText}>Connecting to FPA HUB...</Text>
          </View>
        </View>
      )}

      {/* Connected Pill */}
      {connectedDevice && (
        <View style={styles.connectedContainer}>
          <View style={styles.connectedPill}>
            <View style={styles.statusDot} />
            <Text style={styles.connectedPillText}>
              {connectedDevice.name} Linked
            </Text>
          </View>
        </View>
      )}

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

      {/* Distance Display */}
      <View style={styles.distanceContainer}>
        <Text style={styles.distanceText}>
          Start:{" "}
          {hubDistance !== null
            ? hubDistance.toFixed(1)
            : distance !== null
              ? distance.toFixed(1)
              : "--"}{" "}
          cm
        </Text>
        <Text style={styles.distanceText}>
          Stop: {remoteDistance !== null ? remoteDistance.toFixed(1) : "--"} cm
        </Text>
      </View>

      {/* Timer Display */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(time)}</Text>
        {isFiveTenFive && lapTime !== null ? (
          <Text style={styles.lapText}>Lap: {formatTime(lapTime)}</Text>
        ) : null}
      </View>

      {/* Control Buttons */}
      {isFinished ? (
        <View style={styles.finishedButtonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.startButton, styles.finishedButton]}
            onPress={() => router.push("/user-results")}
            activeOpacity={0.8}
          >
            <Ionicons name="list" size={32} color="#fff" />
            <Text style={styles.buttonText}>View Results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.stopButton, styles.finishedButton]}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={32} color="#fff" />
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          {!hasStarted ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.startButton,
                buttonText !== "ready" && styles.startButtonDisabled,
              ]}
              onPress={handleStart}
              activeOpacity={0.8}
              disabled={buttonText !== "ready"}
            >
              <Text style={styles.buttonText}>
                {buttonText.charAt(0).toUpperCase() + buttonText.slice(1)}
              </Text>
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    alignItems: "center",
  },
  // Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  // Discreet Pill Styles
  connectedContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 10,
    marginBottom: 15,
  },
  connectedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginRight: 6,
  },
  connectedPillText: {
    color: "#2e7d32",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    marginTop: 5,
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
  distanceContainer: {
    position: "absolute",
    top: 10,
    right: 20,
    backgroundColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    zIndex: 1000,
    flexDirection: "row",
    gap: 12,
  },
  distanceText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
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
  },
  lapText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  finishedButtonsContainer: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  finishedButton: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
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
  startButtonDisabled: {
    backgroundColor: "#ccc",
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
    textAlign: "center",
  },
});
