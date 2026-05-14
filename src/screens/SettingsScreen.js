import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../context/TaskContext';
import { useToast } from '../context/ToastContext';
import { sendTestNotification } from '../utils/notificationService';
import ConfirmDialog from '../components/ConfirmDialog';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../utils/theme';

export default function SettingsScreen({ navigation }) {
  const { tasks, permissionsGranted, clearAllTasks } = useTasks();
  const { showToast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const activeCount = useMemo(() => tasks.filter(t => t.isActive).length, [tasks]);

  const handleClearAll = () => {
    if (!tasks.length) { showToast('info', 'Nothing to clear', 'No reminders yet.'); return; }
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    setShowClearConfirm(false);
    await clearAllTasks();
    showToast('success', 'All cleared', 'Reminders removed.');
  };

  const handleTest = async () => {
    if (!permissionsGranted) {
      showToast('error', 'Permission required', 'Enable notifications in Settings first.');
      return;
    }
    try {
      await sendTestNotification();
      showToast('success', 'Test scheduled', 'Check your notification tray in 5 seconds.');
    } catch {
      showToast('error', 'Failed', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ConfirmDialog
        visible={showClearConfirm}
        icon="trash-outline"
        title="Clear All Reminders?"
        message={`All ${tasks.length} reminder(s) and notifications will be permanently deleted.`}
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.72}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero notification status card */}
        <View style={[s.heroCard, { borderColor: permissionsGranted ? COLORS.success + '30' : COLORS.error + '30' }]}>
          <LinearGradient
            colors={permissionsGranted
              ? ['rgba(48,209,88,0.12)', 'rgba(48,209,88,0.04)']
              : ['rgba(255,69,58,0.12)', 'rgba(255,69,58,0.04)']}
            style={s.heroGrad}>
            <View style={[s.heroIconBox, { backgroundColor: permissionsGranted ? COLORS.success + '1C' : COLORS.error + '1C' }]}>
              <Ionicons name={permissionsGranted ? 'notifications' : 'notifications-off'} size={26}
                color={permissionsGranted ? COLORS.success : COLORS.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>Notifications</Text>
              <Text style={[s.heroStatus, { color: permissionsGranted ? COLORS.success : COLORS.error }]}>
                {permissionsGranted ? 'Enabled' : 'Disabled'}
              </Text>
              <Text style={s.heroSub}>
                {permissionsGranted
                  ? `${activeCount} active reminder${activeCount !== 1 ? 's' : ''} will fire on time`
                  : 'Reminders will not fire. Tap System Settings below to enable.'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Mini stats */}
        {tasks.length > 0 && (
          <View style={s.miniStatsRow}>
            {[
              { label: 'Total',  value: tasks.length,               color: COLORS.primary,   icon: 'list-outline' },
              { label: 'Active', value: activeCount,                 color: COLORS.success,   icon: 'radio-button-on-outline' },
              { label: 'Paused', value: tasks.length - activeCount,  color: COLORS.textMuted, icon: 'pause-circle-outline' },
            ].map((stat, i, arr) => (
              <View key={stat.label} style={[s.miniStat, i < arr.length - 1 && s.miniStatBorder]}>
                <Ionicons name={stat.icon} size={14} color={stat.color} style={{ marginBottom: 4 }} />
                <Text style={[s.miniStatValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={s.miniStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        <SectionHeader label="Notifications" icon="notifications-outline" />
        <View style={s.group}>
          <Row icon="settings-outline" iconColor={COLORS.primary}
            label="System Settings" sub="Manage sound, vibration, alerts"
            onPress={() => Linking.openSettings()} showArrow />
          <RowDivider />
          <Row icon="paper-plane-outline" iconColor={COLORS.success}
            label="Send Test Reminder" sub="A notification will arrive in 5 seconds"
            onPress={handleTest} showArrow highlight />
        </View>

        <SectionHeader label="Data" icon="server-outline" />
        <View style={s.group}>
          <Row icon="trash-outline" iconColor={COLORS.error}
            label="Clear All Reminders"
            sub={`${tasks.length} reminder${tasks.length !== 1 ? 's' : ''} stored`}
            onPress={handleClearAll} showArrow destructive />
        </View>

        <SectionHeader label="About" icon="information-circle-outline" />
        <View style={s.group}>
          <Row icon="apps-outline"        iconColor={COLORS.primary}  label="App"          value="NotifyMe" />
          <RowDivider />
          <Row icon="code-slash-outline"  iconColor={COLORS.purple}   label="Version"      value="1.0.0" />
          <RowDivider />
          <Row icon="star-outline"        iconColor={COLORS.warning}  label="Built with"   value="Expo + React Native" />
        </View>

        <View style={s.footerArea}>
          <View style={s.footerDot} />
          <Text style={s.footerText}>NotifyMe · Stay on track, every day</Text>
          <View style={s.footerDot} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ label, icon }) {
  return (
    <View style={sh.headerRow}>
      <Ionicons name={icon} size={13} color={COLORS.textMuted} />
      <Text style={sh.headerLabel}>{label}</Text>
    </View>
  );
}

function RowDivider() {
  return <View style={sh.divider} />;
}

function Row({ icon, iconColor, label, sub, value, onPress, showArrow, highlight, destructive }) {
  return (
    <TouchableOpacity style={[sh.row, highlight && sh.rowHighlight]}
      onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.68 : 1}>
      <View style={[sh.iconBox, { backgroundColor: (iconColor || COLORS.primary) + '18' }]}>
        <Ionicons name={icon} size={16} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sh.label, destructive && { color: COLORS.error }, highlight && { color: COLORS.primary }]}>
          {label}
        </Text>
        {!!sub && <Text style={sh.sub}>{sub}</Text>}
      </View>
      {!!value && <Text style={sh.value}>{value}</Text>}
      {showArrow && <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
}

const sh = StyleSheet.create({
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xxl, marginBottom: SPACING.sm, paddingHorizontal: 4 },
  headerLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: FONTS.weights.semibold },
  divider:     { height: 0.5, backgroundColor: COLORS.border, marginLeft: 56 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 13, gap: SPACING.md },
  rowHighlight:{ backgroundColor: COLORS.primary + '08' },
  iconBox:     { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:       { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium, color: COLORS.textPrimary, letterSpacing: -0.1 },
  sub:         { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },
  value:       { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
});

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  backBtn:     { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: COLORS.border },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, letterSpacing: -0.3 },
  content:     { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.section },

  heroCard: { marginTop: SPACING.xl, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 0.5 },
  heroGrad:    { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.lg, gap: SPACING.md },
  heroIconBox: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroTitle:   { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: 2 },
  heroStatus:  { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, marginBottom: 3 },
  heroSub:     { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, lineHeight: 16 },

  miniStatsRow:    { flexDirection: 'row', marginTop: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  miniStat:        { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  miniStatBorder:  { borderRightWidth: 0.5, borderRightColor: COLORS.border },
  miniStatValue:   { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, letterSpacing: -0.4 },
  miniStatLabel:   { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.8 },

  group:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  footerArea:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.xxl },
  footerDot:   { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textMuted },
  footerText:  { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, letterSpacing: 0.4 },
});
