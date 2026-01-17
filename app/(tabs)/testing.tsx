import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGlobalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function TestingScreen() {
  const {
    userName,
    userImage,
    userId,
    stationId,
    stationName,
    stationShortName,
  } = useGlobalSearchParams();
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    setIsRunning(true);
    setFinalTime(null);
    const startTime = Date.now() - time;

    intervalRef.current = setInterval(() => {
      setTime(Date.now() - startTime);
    }, 10);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setFinalTime(time);

    // Save result to AsyncStorage
    saveResult(time);
  };

  const saveResult = async (timeMs: number) => {
    try {
      const timeInSeconds = (timeMs / 1000).toFixed(2);
      const result = {
        userId: userId as string,
        userName: userName as string,
        userImage: userImage as string,
        stationId: stationId as string,
        stationName: stationName as string,
        stationShortName: stationShortName as string,
        time: timeInSeconds,
        timestamp: new Date().toISOString(),
      };

      // Get existing results from AsyncStorage
      const existingResults = await AsyncStorage.getItem("testResults");
      const results = existingResults ? JSON.parse(existingResults) : [];

      // Add new result
      results.push(result);

      // Save back to AsyncStorage
      await AsyncStorage.setItem("testResults", JSON.stringify(results));

      console.log("Result saved:", result);
    } catch (error) {
      console.error("Error saving result:", error);
    }
  };
  useEffect(() => {
    resetTimer();
  }, [userId]);

  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTime(0);
    setIsRunning(false);
    setFinalTime(null);
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {userName ? (
        <>
          {stationShortName && (
            <View style={styles.stationBadge}>
              <Text style={styles.stationBadgeText}>{stationShortName}</Text>
            </View>
          )}

          <Image
            source={{ uri: userImage as string }}
            style={styles.userImage}
          />
          <Text style={styles.title}>Testing:</Text>
          <Text style={styles.userName}>{userName}</Text>

          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(time)}</Text>
            {finalTime !== null && (
              <Text style={styles.resultText}>
                Final Time: {formatTime(finalTime)}
              </Text>
            )}
          </View>

          <View style={styles.buttonContainer}>
            {!isRunning && finalTime === null && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={startTimer}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={32} color="#fff" />
                <Text style={styles.buttonText}>Start</Text>
              </TouchableOpacity>
            )}

            {isRunning && (
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopTimer}
                activeOpacity={0.8}
              >
                <Ionicons name="stop" size={32} color="#fff" />
                <Text style={styles.buttonText}>Stop</Text>
              </TouchableOpacity>
            )}

            {!isRunning && finalTime !== null && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetTimer}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={32} color="#fff" />
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : (
        <Text style={styles.text}>No user selected</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  stationBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  stationBadgeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  userImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    borderWidth: 4,
    borderColor: "#fff",
  },
  title: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 12,
  },
  userName: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    textAlign: "center",
    marginBottom: 40,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  timerText: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  resultText: {
    fontSize: 20,
    color: "#4CAF50",
    marginTop: 16,
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 20,
  },
  startButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 160,
    justifyContent: "center",
  },
  stopButton: {
    backgroundColor: "#f44336",
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 160,
    justifyContent: "center",
  },
  resetButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 160,
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  text: {
    color: "#fff",
    fontSize: 18,
  },
});
