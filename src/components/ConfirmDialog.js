/**
 * ConfirmDialog — always mounted when parent is mounted; animates in/out
 * based on `visible` prop so exit animations play correctly.
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from "../utils/theme";

export default function ConfirmDialog({
  visible,
  icon,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}) {
  // Lazy init — constructors run only once per mount, not on every render.
  const scaleRef = useRef(null);
  if (!scaleRef.current) scaleRef.current = new Animated.Value(0.9);
  const opacityRef = useRef(null);
  if (!opacityRef.current) opacityRef.current = new Animated.Value(0);
  const scale = scaleRef.current;
  const opacity = opacityRef.current;
  // Track modal mount separately so it stays mounted during exit animation
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const confirmColors = destructive
    ? COLORS.gradientError
    : COLORS.gradientPrimary;
  const iconColor = destructive ? COLORS.error : COLORS.primary;
  const iconBg = destructive ? COLORS.errorMuted : COLORS.primaryMuted;
  const iconBorder = destructive ? COLORS.error + "28" : COLORS.primary + "28";

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onCancel}
    >
      <Animated.View style={[s.overlay, { opacity }]}>
        <Animated.View style={[s.sheet, { transform: [{ scale }] }]}>
          {!!icon && (
            <View
              style={[
                s.iconRing,
                { backgroundColor: iconBg, borderColor: iconBorder },
              ]}
            >
              <Ionicons name={icon} size={30} color={iconColor} />
            </View>
          )}
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          <View style={s.sep} />
          <View style={s.btnCol}>
            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.85}
              style={{ width: "100%" }}
            >
              <LinearGradient
                colors={confirmColors}
                style={s.btnConfirm}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={s.btnConfirmTxt}>{confirmLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {!!cancelLabel && (
              <TouchableOpacity
                style={s.btnCancel}
                onPress={onCancel}
                activeOpacity={0.78}
              >
                <Text style={s.btnCancelTxt}>{cancelLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxl,
  },
  sheet: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.xxxl,
    padding: SPACING.xxl,
    width: "100%",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: COLORS.borderMid,
    ...SHADOWS.lg,
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textTertiary,
    textAlign: "center",
    lineHeight: 21,
  },
  sep: {
    width: "100%",
    height: 0.5,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xl,
  },
  btnCol: { width: "100%", gap: SPACING.sm },
  btnConfirm: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: RADIUS.full,
    alignItems: "center",
    ...SHADOWS.blue,
  },
  btnConfirmTxt: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: "#fff",
    letterSpacing: 0.1,
  },
  btnCancel: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    alignItems: "center",
    backgroundColor: COLORS.surfaceHigh,
  },
  btnCancelTxt: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textSecondary,
  },
});
