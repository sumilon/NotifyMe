import React, { useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  REPEAT_TYPES,
  DAYS_OF_WEEK,
  getCategoryMeta,
  formatTaskTime,
} from "../utils/theme";

// ─── TaskCard ──────────────────────────────────────────────────────────────────
export const TaskCard = React.memo(function TaskCard({ task, onToggle, onEdit, onDelete, fired = false }) {
  // Lazy init — Animated.Value constructor runs only once, not on every render.
  const scaleAnim = useRef(null);
  if (!scaleAnim.current) scaleAnim.current = new Animated.Value(1);
  const opacityAnim = useRef(null);
  if (!opacityAnim.current) opacityAnim.current = new Animated.Value(0);
  const slideAnim = useRef(null);
  if (!slideAnim.current) slideAnim.current = new Animated.Value(20);

  // Unwrap for convenience (same ref object, just avoids .current everywhere below)
  const scale = scaleAnim.current;
  const opacity = opacityAnim.current;
  const slide = slideAnim.current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        tension: 70,
        friction: 11,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []); // run once on mount

  // Stable press handlers — defined with useCallback so they don't
  // cause child re-renders when the parent re-renders.
  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.972,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handleEdit = useCallback(() => onEdit(task), [onEdit, task]);
  const handleDelete = useCallback(() => onDelete(task.id), [onDelete, task.id]);
  const handleToggle = useCallback(() => onToggle(task.id), [onToggle, task.id]);

  const { timeDisplay, repeatLabel, accent, iconName, inactive } =
    useMemo(() => {
      const cat = getCategoryMeta(task.category);
      const timeDisp = formatTaskTime(task);

      const repeat = (() => {
        if (task.repeatType === REPEAT_TYPES.DAILY) return "Every day";
        if (task.repeatType === REPEAT_TYPES.WEEKLY) {
          if (!task.selectedDays?.length) return "Weekly";
          return task.selectedDays
            .sort((a, b) => a - b)
            .map((d) => DAYS_OF_WEEK[d]?.full?.slice(0, 3))
            .join(", ");
        }
        if (task.dateYear !== undefined) {
          const d = new Date(task.dateYear, task.dateMonth, task.dateDay);
          return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
        return "One time";
      })();

      return {
        timeDisplay: timeDisp,
        repeatLabel: repeat,
        accent: cat.color,
        iconName: cat.icon,
        inactive: !task.isActive,
      };
    }, [task]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { translateY: slide }],
        opacity,
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleEdit}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.touchable}
      >
        <View
          style={[
            styles.card,
            inactive && styles.cardInactive,
            fired && styles.cardFired,
          ]}
        >
          {/* Left accent stripe */}
          <View
            style={[
              styles.accentStripe,
              {
                backgroundColor: fired
                  ? COLORS.surfaceMid
                  : inactive
                    ? COLORS.border
                    : accent,
              },
            ]}
          />
          <View style={styles.cardInner}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: fired
                      ? COLORS.surfaceMid
                      : inactive
                        ? COLORS.surfaceHigh
                        : accent + "1C",
                  },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={17}
                  color={
                    fired
                      ? COLORS.textTertiary
                      : inactive
                        ? COLORS.textMuted
                        : accent
                  }
                />
              </View>
              <Text
                style={[
                  styles.title,
                  inactive && styles.titleInactive,
                  fired && styles.titleFired,
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              {fired && (
                <View style={styles.firedBadge}>
                  <Text style={styles.firedBadgeText}>FIRED</Text>
                </View>
              )}
              {!fired && inactive && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>PAUSED</Text>
                </View>
              )}
              {!fired && (
                <Switch
                  value={task.isActive}
                  onValueChange={handleToggle}
                  trackColor={{
                    false: COLORS.surfaceHigh,
                    true: accent + "55",
                  }}
                  thumbColor={task.isActive ? accent : "#636366"}
                  ios_backgroundColor={COLORS.surfaceHigh}
                  style={styles.toggle}
                />
              )}
            </View>

            {/* Description */}
            {!!task.description && (
              <Text
                style={[
                  styles.desc,
                  inactive && styles.descInactive,
                  fired && styles.descFired,
                ]}
                numberOfLines={2}
              >
                {task.description}
              </Text>
            )}

            {/* Footer row */}
            <View style={styles.footerRow}>
              {/* Time pill */}
              <View
                style={[
                  styles.timePill,
                  {
                    backgroundColor: fired
                      ? COLORS.surfaceMid
                      : inactive
                        ? COLORS.surfaceHigh
                        : accent + "18",
                  },
                ]}
              >
                <Ionicons
                  name="time"
                  size={10}
                  color={
                    fired
                      ? COLORS.textTertiary
                      : inactive
                        ? COLORS.textMuted
                        : accent
                  }
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.timeText,
                    {
                      color: fired
                        ? COLORS.textTertiary
                        : inactive
                          ? COLORS.textMuted
                          : accent,
                    },
                  ]}
                >
                  {timeDisplay}
                </Text>
                {/* Extra times badge */}
                {(task.additionalTimes?.length ?? 0) > 0 && (
                  <View
                    style={[
                      styles.timesCountBadge,
                      {
                        backgroundColor: fired
                          ? COLORS.surfaceHigh
                          : accent + "28",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timesCountText,
                        {
                          color: fired ? COLORS.textTertiary : accent,
                        },
                      ]}
                    >
                      +{task.additionalTimes.length}
                    </Text>
                  </View>
                )}
              </View>

              {/* Repeat / date label */}
              <View style={styles.repeatPill}>
                <Ionicons
                  name="repeat"
                  size={10}
                  color={COLORS.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.repeatText,
                    fired && styles.repeatTextFired,
                  ]}
                  numberOfLines={1}
                >
                  {repeatLabel}
                </Text>
              </View>

              {/* Delete button */}
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.deleteBtnInner}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ onAdd }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fade = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    });

    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1.08,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0.8,
          duration: 2200,
          useNativeDriver: true,
        }),
      ]),
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );

    fade.start();
    ring.start();
    pulse.start();

    return () => {
      fade.stop();
      ring.stop();
      pulse.stop();
    };
  }, []);

  return (
    <Animated.View style={[styles.empty, { opacity: fadeAnim }]}>
      <Animated.View
        style={[styles.emptyOuterRing, { transform: [{ scale: ringAnim }] }]}
      />
      <Animated.View
        style={[styles.emptyInnerRing, { transform: [{ scale: pulseAnim }] }]}
      >
        <LinearGradient
          colors={["rgba(10,132,255,0.18)", "rgba(10,132,255,0.06)"]}
          style={styles.emptyGradCircle}
        >
          <Ionicons name="notifications" size={38} color={COLORS.primary} />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.emptyTitle}>No Reminders Yet</Text>
      <Text style={styles.emptySubtitle}>
        Stay on top of everything.{"\n"}Create your first reminder now.
      </Text>
      <TouchableOpacity onPress={onAdd} activeOpacity={0.86}>
        <LinearGradient
          colors={COLORS.gradientPrimary}
          style={styles.emptyBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons
            name="add"
            size={18}
            color="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.emptyBtnText}>New Reminder</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── StatsBar ──────────────────────────────────────────────────────────────────
// Accepts pre-computed counts from HomeScreen to avoid re-filtering the task
// array here (HomeScreen already has activeCount/pausedCount in useMemo).
export const StatsBar = React.memo(function StatsBar({ total, active, paused }) {
  const stats = [
    { label: "Total", value: total, color: COLORS.primary, icon: "layers" },
    {
      label: "Active",
      value: active,
      color: COLORS.success,
      icon: "checkmark-circle",
    },
    {
      label: "Paused",
      value: paused,
      color: COLORS.textMuted,
      icon: "pause-circle",
    },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={[styles.statCard, i < stats.length - 1 && styles.statBorder]}
        >
          <Ionicons
            name={s.icon}
            size={15}
            color={s.color}
            style={{ marginBottom: 5 }}
          />
          <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  touchable: { marginHorizontal: SPACING.lg, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.sm,
    flexDirection: "row",
  },
  cardInactive: { opacity: 0.58 },
  cardFired: { opacity: 0.72 },
  accentStripe: { width: 3, alignSelf: "stretch" },
  cardInner: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  pausedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pausedBadgeText: {
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  firedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.successMuted,
    borderWidth: 0.5,
    borderColor: COLORS.success + "40",
  },
  firedBadgeText: {
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    color: COLORS.success,
    letterSpacing: 0.8,
  },

  title: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.15,
  },
  titleInactive: { color: COLORS.textMuted },
  titleFired: { color: COLORS.textSecondary, textDecorationLine: "line-through" },
  toggle: { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }], marginRight: -4 },

  desc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    marginBottom: SPACING.sm,
    lineHeight: 17,
    paddingLeft: 40,
  },
  descInactive: { color: COLORS.textMuted },
  descFired: { color: COLORS.textTertiary },

  footerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  timeText: {
    fontSize: FONTS.sizes.xxs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.3,
  },
  timesCountBadge: {
    marginLeft: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  timesCountText: {
    fontSize: FONTS.sizes.xxs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.2,
  },
  repeatPill: { flex: 1, flexDirection: "row", alignItems: "center" },
  repeatText: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    letterSpacing: 0.1,
    flex: 1,
  },
  repeatTextFired: { color: COLORS.textTertiary },
  deleteBtn: { padding: 2 },
  deleteBtnInner: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceHigh,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.section,
  },
  emptyOuterRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.08)",
    top: "50%",
    marginTop: -160,
  },
  emptyInnerRing: { marginBottom: SPACING.xxl },
  emptyGradCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.18)",
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textTertiary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: SPACING.xxl,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.full,
    ...SHADOWS.blue,
  },
  emptyBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: "#fff",
    letterSpacing: 0.1,
  },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  statCard: { flex: 1, alignItems: "center", paddingVertical: SPACING.md },
  statBorder: { borderRightWidth: 0.5, borderRightColor: COLORS.border },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
