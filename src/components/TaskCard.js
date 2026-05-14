import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, REPEAT_TYPES, DAYS_OF_WEEK, getCategoryMeta, formatTaskTime } from '../utils/theme';

// ─── TaskCard ──────────────────────────────────────────────────────────────────
export function TaskCard({ task, onToggle, onEdit, onDelete, fired = false }) {
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim,   { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.972, tension: 300, friction: 20, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,     tension: 300, friction: 20, useNativeDriver: true }).start();

  // useMemo for derived display values so they don't recompute on unrelated re-renders
  const { timeDisplay, repeatLabel, accent, iconName, inactive } = useMemo(() => {
    const cat      = getCategoryMeta(task.category);
    // formatTaskTime reads task.timeHour / task.timeMinute (local integers) — never UTC ISO
    const timeDisp = formatTaskTime(task);

    const repeat = (() => {
      if (task.repeatType === REPEAT_TYPES.DAILY) return 'Every day';
      if (task.repeatType === REPEAT_TYPES.WEEKLY) {
        if (!task.selectedDays?.length) return 'Weekly';
        return task.selectedDays.sort((a, b) => a - b)
          .map(d => DAYS_OF_WEEK[d]?.full?.slice(0, 3)).join(', ');
      }
      // ONCE — use local date integers if available
      if (task.dateYear !== undefined) {
        const d = new Date(task.dateYear, task.dateMonth, task.dateDay);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      try { return new Date(task.date || task.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
      catch { return 'One time'; }
    })();

    return {
      timeDisplay:   timeDisp,
      repeatLabel:   repeat,
      accent:        cat.color,
      iconName:      cat.icon,
      inactive:      !task.isActive,
    };
  }, [task]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }, { translateY: slideAnim }], opacity: opacityAnim }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onEdit(task)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.touchable}
      >
        <View style={[styles.card, inactive && styles.cardInactive, fired && styles.cardFired]}>
          {/* Left accent stripe */}
          <View style={[styles.accentStripe, { backgroundColor: fired ? COLORS.surfaceMid : inactive ? COLORS.border : accent }]} />
          <View style={styles.cardInner}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={[styles.iconBadge, { backgroundColor: fired ? COLORS.surfaceMid : inactive ? COLORS.surfaceHigh : accent + '1C' }]}>
                <Ionicons name={iconName} size={17} color={fired ? COLORS.textTertiary : inactive ? COLORS.textMuted : accent} />
              </View>
              <Text style={[styles.title, inactive && styles.titleInactive, fired && styles.titleFired]} numberOfLines={1}>
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
                  onValueChange={() => onToggle(task.id)}
                  trackColor={{ false: COLORS.surfaceHigh, true: accent + '55' }}
                  thumbColor={task.isActive ? accent : '#636366'}
                  ios_backgroundColor={COLORS.surfaceHigh}
                  style={styles.toggle}
                />
              )}
            </View>

            {/* Description */}
            {!!task.description && (
              <Text style={[styles.desc, inactive && styles.descInactive, fired && styles.descFired]} numberOfLines={1}>
                {task.description}
              </Text>
            )}

            {/* Footer */}
            <View style={styles.footerRow}>
              <View style={[styles.timePill, { backgroundColor: fired ? COLORS.surfaceMid : inactive ? COLORS.border : accent + '18' }]}>
                <Ionicons name="time" size={11} color={fired ? COLORS.textTertiary : inactive ? COLORS.textMuted : accent} style={{ marginRight: 4 }} />
                <Text style={[styles.timeText, { color: fired ? COLORS.textTertiary : inactive ? COLORS.textMuted : accent }]}>
                  {timeDisplay}
                </Text>
              </View>
              <View style={styles.repeatPill}>
                <Ionicons name="repeat" size={11} color={fired ? COLORS.textTertiary : COLORS.textMuted} style={{ marginRight: 3 }} />
                <Text style={[styles.repeatText, fired && styles.repeatTextFired]} numberOfLines={1}>{repeatLabel}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDelete(task.id)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <View style={styles.deleteBtnInner}>
                  <Ionicons name="trash" size={14} color={fired ? COLORS.textTertiary : COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ onAdd }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const ringAnim  = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 2400, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 2400, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.85, duration: 3000, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View style={[styles.empty, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.emptyOuterRing, { transform: [{ scale: ringAnim }] }]} />
      <Animated.View style={[styles.emptyInnerRing, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={['rgba(10,132,255,0.18)', 'rgba(10,132,255,0.06)']}
          style={styles.emptyGradCircle}
        >
          <Ionicons name="notifications" size={38} color={COLORS.primary} />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.emptyTitle}>No Reminders Yet</Text>
      <Text style={styles.emptySubtitle}>
        Stay on top of everything.{'\n'}Create your first reminder now.
      </Text>
      <TouchableOpacity onPress={onAdd} activeOpacity={0.86}>
        <LinearGradient colors={COLORS.gradientPrimary} style={styles.emptyBtn}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.emptyBtnText}>New Reminder</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── StatsBar ──────────────────────────────────────────────────────────────────
export function StatsBar({ tasks }) {
  // useMemo: only recompute when tasks array reference changes
  const { total, active, paused } = useMemo(() => ({
    total:  tasks.length,
    active: tasks.filter(t =>  t.isActive).length,
    paused: tasks.filter(t => !t.isActive).length,
  }), [tasks]);

  const stats = [
    { label: 'Total',  value: total,  color: COLORS.primary,   icon: 'layers'          },
    { label: 'Active', value: active, color: COLORS.success,   icon: 'checkmark-circle'},
    { label: 'Paused', value: paused, color: COLORS.textMuted, icon: 'pause-circle'    },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.statCard, i < stats.length - 1 && styles.statBorder]}>
          <Ionicons name={s.icon} size={15} color={s.color} style={{ marginBottom: 5 }} />
          <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  touchable: { marginHorizontal: SPACING.lg, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 0.5, borderColor: COLORS.border,
    overflow: 'hidden', ...SHADOWS.sm,
    flexDirection: 'row',
  },
  cardInactive:  { opacity: 0.58 },
  cardFired:     { opacity: 0.72 },  // raised from 0.42 — more readable
  accentStripe:  { width: 3, alignSelf: 'stretch' },
  cardInner: { flex: 1, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.md },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  iconBadge: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  pausedBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  pausedBadgeText: { fontSize: 9, fontWeight: FONTS.weights.bold, color: COLORS.textMuted, letterSpacing: 0.8 },
  firedBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs,
    backgroundColor: COLORS.successMuted,
    borderWidth: 0.5, borderColor: COLORS.success + '40',
  },
  firedBadgeText: { fontSize: 9, fontWeight: FONTS.weights.bold, color: COLORS.success, letterSpacing: 0.8 },

  title:         { flex: 1, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, letterSpacing: -0.15 },
  titleInactive: { color: COLORS.textMuted },
  titleFired:    { color: COLORS.textSecondary, textDecorationLine: 'line-through' },  // brighter than textMuted
  toggle:        { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }], marginRight: -4 },

  desc:         { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginBottom: SPACING.sm, lineHeight: 17, paddingLeft: 40 },
  descInactive: { color: COLORS.textMuted },
  descFired:    { color: COLORS.textTertiary },

  footerRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  timePill:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.full },
  timeText:       { fontSize: FONTS.sizes.xxs, fontWeight: FONTS.weights.bold, letterSpacing: 0.3 },
  repeatPill:     { flex: 1, flexDirection: 'row', alignItems: 'center' },
  repeatText:     { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, letterSpacing: 0.1, flex: 1 },
  repeatTextFired:{ color: COLORS.textTertiary },
  deleteBtn:      { padding: 2 },
  deleteBtnInner: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceHigh },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxxl, paddingVertical: SPACING.section },
  emptyOuterRing: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(10,132,255,0.08)', top: '50%', marginTop: -160 },
  emptyInnerRing: { marginBottom: SPACING.xxl },
  emptyGradCircle: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(10,132,255,0.18)' },
  emptyTitle:    { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm, letterSpacing: -0.4 },
  emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 21, marginBottom: SPACING.xxl },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: SPACING.xxl, borderRadius: RADIUS.full, ...SHADOWS.blue },
  emptyBtnText:  { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: '#fff', letterSpacing: 0.1 },

  statsRow:   { flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  statCard:   { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statBorder: { borderRightWidth: 0.5, borderRightColor: COLORS.border },
  statValue:  { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, letterSpacing: -0.4 },
  statLabel:  { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.8 },
});
