import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Tiny wrapper around expo-haptics.
 * - No-op on web (Haptics throws "not implemented")
 * - Swallows all errors so haptics never crash the app
 */

const safe = (fn) => {
  if (Platform.OS === "web") return;
  try {
    fn();
  } catch {
    /* ignore */
  }
};

export const hapticLight = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const hapticMedium = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const hapticHeavy = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

export const hapticSuccess = () =>
  safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
export const hapticWarning = () =>
  safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
export const hapticError = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

export const hapticSelection = () => safe(() => Haptics.selectionAsync());
