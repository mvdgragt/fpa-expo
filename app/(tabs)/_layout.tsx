import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BLEProvider } from "../../context/BLEContext";
import { SelectedUserProvider } from "../../context/SelectedUserContext";

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SelectedUserProvider>
      <BLEProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ble-test" options={{ title: "BLE Test" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add-user" options={{ headerShown: false }} />
            {/* REMOVED: <Stack.Screen name="user-results" options={{ headerShown: false }} /> */}
          </Stack>
        </SafeAreaProvider>
      </BLEProvider>
    </SelectedUserProvider>
  );
}
