import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SelectedUserProvider } from "../context/SelectedUserContext";

// Keep the splash screen visible while we initialize
//SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen once app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <SelectedUserProvider>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-user" options={{ headerShown: false }} />
          <Stack.Screen name="user-results" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </SelectedUserProvider>
  );
}
