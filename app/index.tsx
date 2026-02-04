import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  // Removed unused isChecking state

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const session = await AsyncStorage.getItem("userSession");

      if (session) {
        // User is logged in, go to tabs
        router.replace("/(tabs)/stations");
      } else {
        // User is not logged in, go to login
        router.replace("/login");
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      router.replace("/login");
    } finally {
      // Removed setIsChecking(false) since isChecking is not used
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
});
