// app/_layout.tsx
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BleProvider } from "../context/BLEContext"; // Updated import
import { SelectedUserProvider } from "../context/SelectedUserContext";

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <BleProvider>
      {/* Moved BleProvider to outermost wrapper */}
      <SelectedUserProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="admin-login" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="select-user" />
            <Stack.Screen name="add-user" />
            <Stack.Screen name="user-profile" />
          </Stack>
        </SafeAreaProvider>
      </SelectedUserProvider>
    </BleProvider>
  );
}
