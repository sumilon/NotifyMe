import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../utils/theme";

const CONFIGS = {
  success: {
    bg: COLORS.success + "18",
    border: COLORS.success,
    icon: "checkmark-circle",
    iconColor: COLORS.success,
  },
  error: {
    bg: COLORS.error + "18",
    border: COLORS.error,
    icon: "close-circle",
    iconColor: COLORS.error,
  },
  warning: {
    bg: COLORS.warning + "18",
    border: COLORS.warning,
    icon: "warning",
    iconColor: COLORS.warning,
  },
  info: {
    bg: COLORS.info + "18",
    border: COLORS.info,
    icon: "information-circle",
    iconColor: COLORS.info,
  },
};

// Animation duration constants
const ANIM_IN_DURATION = 180;
const ANIM_OUT_DURATION = 300;
// Must match the timeout in ToastContext so the out animation plays
// just before the context nulls the toast.
const DISPLAY_DURATION = 3500;
const TOAST_HEIGHT = 80; // generous estimate; keeps toast fully off-screen

export default function Toast({ toast }) {
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(-(TOAST_HEIGHT + insets.top))).current;
  const op = useRef(new Animated.Value(0)).current;

  // Animated refs so we can stop in-flight animations on cleanup
  const inAnimRef = useRef(null);
  const outAnimRef = useRef(null);
  const outTimerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;

    // Reset position before animating in
    ty.setValue(-(TOAST_HEIGHT + insets.top));
    op.setValue(0);

    // Stop any in-flight out animation
    outAnimRef.current?.stop();
    clearTimeout(outTimerRef.current);

    inAnimRef.current = Animated.parallel([
      Animated.spring(ty, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: 1,
        duration: ANIM_IN_DURATION,
        useNativeDriver: true,
      }),
    ]);
    inAnimRef.current.start();

    // Schedule exit animation slightly before ToastContext nulls the toast,
    // so the visual slide-out plays smoothly without a jump.
    outTimerRef.current = setTimeout(() => {
      outAnimRef.current = Animated.parallel([
        Animated.timing(ty, {
          toValue: -(TOAST_HEIGHT + insets.top),
          duration: ANIM_OUT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0,
          duration: ANIM_OUT_DURATION,
          useNativeDriver: true,
        }),
      ]);
      outAnimRef.current.start();
    }, DISPLAY_DURATION - ANIM_OUT_DURATION);

    return () => {
      inAnimRef.current?.stop();
      outAnimRef.current?.stop();
      clearTimeout(outTimerRef.current);
    };
  }, [toast, insets.top]); // insets.top included: orientation/keyboard changes can update safe area

  if (!toast) return null;
  const cfg = CONFIGS[toast.type] || CONFIGS.info;

  // top offset: safe area inset + a small breathing gap
  const topOffset = insets.top + 8;

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          top: topOffset,
          borderColor: cfg.border + "40",
          transform: [{ translateY: ty }],
          opacity: op,
        },
      ]}
      pointerEvents="none"
    >
      <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>
          {toast.title}
        </Text>
        {!!toast.message && (
          <Text style={s.msg} numberOfLines={1}>
            {toast.message}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    backgroundColor: "#18181B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 18,
  },
  title: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },
  msg: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 1 },
});
