import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  getCategoryMeta,
  formatTaskTime,
} from "../utils/theme";

export default React.memo(function NextUpBanner({ task, onPress }) {
  if (!task) return null;
  const meta = getCategoryMeta(task.category);

  // Find the next upcoming time slot (soonest in the future)
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const allSlots = [
    { hour: task.timeHour ?? 0, minute: task.timeMinute ?? 0 },
    ...(task.additionalTimes || []),
  ].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const nextSlot =
    allSlots.find((s) => s.hour * 60 + s.minute > nowMins) || allSlots[0];
  const displayTask = {
    ...task,
    timeHour: nextSlot.hour,
    timeMinute: nextSlot.minute,
  };
  const totalTimes = allSlots.length;

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
            {formatTaskTime(displayTask)}
          </Text>
          {totalTimes > 1 && (
            <Text style={[s.timesCount, { color: meta.color }]}>
              {" "}
              · {totalTimes}×
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
