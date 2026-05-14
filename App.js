import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TaskProvider } from './src/context/TaskContext';
import { ToastProvider } from './src/context/ToastContext';
import HomeScreen from './src/screens/HomeScreen';
import AddTaskScreen from './src/screens/AddTaskScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { setupNotificationHandler } from './src/utils/notificationService';
import { COLORS } from './src/utils/theme';

setupNotificationHandler();

const Stack = createStackNavigator();

export default function App() {
  const notifListener    = useRef();
  const responseListener = useRef();
  const navRef = useRef();

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(n => {
      console.log('[NotifyMe] Received:', n.request.content.title);
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      navRef.current?.navigate('Home');
    });
    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TaskProvider>
          {/* ToastProvider wraps navigation so any screen can call useToast() */}
          <ToastProvider>
            <NavigationContainer ref={navRef}>
              <StatusBar style="light" backgroundColor={COLORS.background} />
              <Stack.Navigator screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: COLORS.background },
              }}>
                <Stack.Screen name="Home"     component={HomeScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="AddTask"  component={AddTaskScreen}
                  options={{ presentation: 'modal' }} />
              </Stack.Navigator>
            </NavigationContainer>
          </ToastProvider>
        </TaskProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
