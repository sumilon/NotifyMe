import React, { useMemo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS, getCategoryMeta } from "../utils/theme";

function formatFireAt(fireAt) {
  if (!fireAt) return "";
  const now = new Date();
  const diffMs = fireAt - now;
  const diffMins = Math.round(diffMs / 60000);

  // Within the next 60 minutes — show relative time
  if (diffMins > 0 && diffMins <= 60) {
    if (diffMins === 1) return "in 1 min";
    return `in ${diffMins} mins`;
  }

  // Within the next 24 hours — show hours
  const diffHours = Math.round(diffMs / 3600000);
  if (diffMins > 0 && diffHours <= 23) {
    const remainingMins = diffMins % 60;
    if (remainingMins === 0) return `in ${diffHours}h`;
    return `in ${diffHours}h ${remainingMins}m`;
  }

  // Beyond today — fall back to absolute label
  const sameDay =
    fireAt.getFullYear() === now.getFullYear() &&
    fireAt.getMonth() === now.getMonth() &&
    fireAt.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    fireAt.getFullYear() === tomorrow.getFullYear() &&
    fireAt.getMonth() === tomorrow.getMonth() &&
    fireAt.getDate() === tomorrow.getDate();

  const h = fireAt.getHours();
  const m = fireAt.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${String(m).padStart(2, "0")} ${period}`;

  if (sameDay) return `Today · ${timeStr}`;
  if (isTomorrow) return `Tomorrow · ${timeStr}`;
  return `${fireAt.toLocaleDateString("en-US", { weekday: "short" })} · ${timeStr}`;
}

export default React.memo(function NextUpBanner({ task, fireAt, onPress }) {
  if (!task) return null;

  const { meta, timesPerDay, formattedTime } = useMemo(() => ({
    meta: getCategoryMeta(task.category),
    timesPerDay: 1 + (task.additionalTimes?.length ?? 0),
    formattedTime: formatFireAt(fireAt),
  }), [task.category, task.additionalTimes, fireAt]);

  return (
    <TouchableOpacity
      style={s.banner}
      onPress={() => onPress(task)}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={[meta.color + "22", meta.color + "0A"]}
        style={s.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={[s.iconBox, { backgroundColor: meta.color + "28" }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Next up</Text>
          <Text style={s.title} numberOfLines={1}>
            {task.title}
          </Text>
        </View>
        <View
          style={[
            s.timePill,
            {
              backgroundColor: meta.color + "22",
              borderColor: meta.color + "40",
            },
          ]}
        >
          <Ionicons
            name="time"
            size={11}
            color={meta.color}
            style={{ marginRight: 3 }}
          />
          <Text style={[s.timeText, { color: meta.color }]}>
            {formattedTime}
          </Text>
          {timesPerDay > 1 && (
            <Text style={[s.timesCount, { color: meta.color }]}>
              {" "}· {timesPerDay}×
            </Text>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const s = StyleSheet.create({
  banner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  grad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  title: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 0.5,
  },
  timeText: {
    fontSize: FONTS.sizes.xxs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.3,
  },
  timesCount: {
    fontSize: FONTS.sizes.xxs,
    fontWeight: FONTS.weights.semibold,
    opacity: 0.8,
  },
});
