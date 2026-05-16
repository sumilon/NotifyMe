import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TaskProvider } from "./src/context/TaskContext";
import { ToastProvider } from "./src/context/ToastContext";
import HomeScreen from "./src/screens/HomeScreen";
import AddTaskScreen from "./src/screens/AddTaskScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { setupNotificationHandler } from "./src/utils/notificationService";
import { COLORS } from "./src/utils/theme";

setupNotificationHandler();

const Stack = createStackNavigator();

export default function App() {
  const notifListener = useRef(null);
  const responseListener = useRef(null);
  const appStateListener = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(
      (n) => {
        console.log("[NotifyMe] Received:", n.request.content.title);
      },
    );

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(() => {
        navRef.current?.navigate("Home");
      });

    appStateListener.current = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
      appStateListener.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* ToastProvider must wrap TaskProvider so TaskContext can show toasts */}
        <ToastProvider>
          <TaskProvider>
            <NavigationContainer ref={navRef}>
              <StatusBar style="light" backgroundColor={COLORS.background} />
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  cardStyle: { backgroundColor: COLORS.background },
                }}
              >
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen
                  name="AddTask"
                  component={AddTaskScreen}
                  options={{ presentation: "modal" }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </TaskProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
