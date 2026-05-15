import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { sendTestNotification } from "../utils/notificationService";
import { useTasks } from "../context/TaskContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { COLORS, FONTS, SPACING, RADIUS } from "../utils/theme";
import {
  hapticLight,
  hapticSuccess,
  hapticWarning,
  hapticError,
} from "../utils/haptics";

const SettingRow = React.memo(function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  danger,
  disabled,
  rightElement,
}) {
  return (
    <TouchableOpacity
      style={[s.row, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.75}
    >
      <View
        style={[
          s.rowIconBox,
          { backgroundColor: (iconColor || COLORS.primary) + "18" },
        ]}
      >
        <Ionicons name={icon} size={18} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, danger && { color: COLORS.error }]}>
          {title}
        </Text>
        {subtitle && <Text style={s.rowSub}>{subtitle}</Text>}
      </View>
      {rightElement ||
        (onPress && (
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        ))}
    </TouchableOpacity>
  );
});

const SectionHeader = React.memo(function SectionHeader({ text }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionLine} />
      <Text style={s.sectionText}>{text}</Text>
    </View>
  );
});

export default function SettingsScreen({ navigation }) {
  const { tasks, permissionsGranted, clearAllTasks } = useTasks();
  const { showToast } = useToast();
  const [clearConfirm, setClearConfirm] = useState(false);

  const { activeCount, pausedCount } = useMemo(
    () =>
      tasks.reduce(
        (acc, t) => {
          if (t.isActive) acc.activeCount++;
          else acc.pausedCount++;
          return acc;
        },
        { activeCount: 0, pausedCount: 0 },
      ),
    [tasks],
  );

  // ─── Send a test notification (5 seconds) ───────────────────────────────────
  const handleSendTest = useCallback(async () => {
    hapticLight();
    if (!permissionsGranted) {
      hapticError();
      showToast(
        "error",
        "Permission required",
        "Enable notifications in Settings first.",
      );
      return;
    }
    try {
      await sendTestNotification();
      hapticSuccess();
      showToast(
        "success",
        "Test scheduled",
        "Notification will fire in 5 seconds",
      );
    } catch (e) {
      __DEV__ && console.error("Test notification failed:", e);
      hapticError();
      showToast(
        "error",
        "Test failed",
        "Could not schedule the test notification.",
      );
    }
  }, [permissionsGranted, showToast]);

  // ─── Open system Settings (for permissions) ─────────────────────────────────
  const handleOpenSystemSettings = useCallback(() => {
    hapticLight();
    Linking.openSettings();
  }, []);

  // ─── Clear All Reminders flow ───────────────────────────────────────────────
  const handleClearAllRequest = useCallback(() => {
    hapticLight();
    if (tasks.length === 0) {
      showToast("info", "Nothing to clear", "You have no reminders.");
      return;
    }
    setClearConfirm(true);
  }, [tasks.length, showToast]);

  const handleClearAllConfirm = useCallback(async () => {
    hapticWarning();
    const count = tasks.length;
    await clearAllTasks();
    setClearConfirm(false);
    showToast(
      "warning",
      "Cleared",
      `${count} reminder${count !== 1 ? "s" : ""} removed`,
    );
  }, [tasks.length, clearAllTasks, showToast]);

  // ─── Render helpers ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ConfirmDialog
        visible={clearConfirm}
        icon="trash"
        title="Clear All Reminders?"
        message={`All ${tasks.length} reminder${tasks.length !== 1 ? "s" : ""} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleClearAllConfirm}
        onCancel={() => setClearConfirm(false)}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          style={s.backBtn}
          activeOpacity={0.72}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Overview */}
        <View style={s.statsCard}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{tasks.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: COLORS.success }]}>
              {activeCount}
            </Text>
            <Text style={s.statLabel}>Active</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: COLORS.textMuted }]}>
              {pausedCount}
            </Text>
            <Text style={s.statLabel}>Paused</Text>
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader text="Notifications" />
        <View style={s.card}>
          <SettingRow
            icon={permissionsGranted ? "checkmark-circle" : "alert-circle"}
            iconColor={permissionsGranted ? COLORS.success : COLORS.warning}
            title="Permission Status"
            subtitle={
              permissionsGranted
                ? "Notifications are enabled"
                : "Notifications are disabled"
            }
            rightElement={
              <View
                style={[
                  s.statusPill,
                  {
                    backgroundColor:
                      (permissionsGranted ? COLORS.success : COLORS.warning) +
                      "20",
                  },
                ]}
              >
                <Text
                  style={[
                    s.statusPillText,
                    {
                      color: permissionsGranted
                        ? COLORS.success
                        : COLORS.warning,
                    },
                  ]}
                >
                  {permissionsGranted ? "ON" : "OFF"}
                </Text>
              </View>
            }
          />
          <View style={s.divider} />
          <SettingRow
            icon="settings-outline"
            title="Open System Settings"
            subtitle="Manage notification permissions"
            onPress={handleOpenSystemSettings}
          />
          <View style={s.divider} />
          <SettingRow
            icon="paper-plane"
            iconColor={COLORS.primary}
            title="Send Test Reminder"
            subtitle="Fires in 5 seconds"
            onPress={handleSendTest}
            disabled={!permissionsGranted}
          />
        </View>

        {/* Data Management */}
        <SectionHeader text="Data" />
        <View style={s.card}>
          <SettingRow
            icon="trash"
            iconColor={COLORS.error}
            title="Clear All Reminders"
            subtitle="Permanently remove every reminder"
            onPress={handleClearAllRequest}
            danger
          />
        </View>

        {/* About */}
        <SectionHeader text="About" />
        <View style={s.card}>
          <SettingRow
            icon="information-circle"
            title="Version"
            rightElement={<Text style={s.versionText}>1.0.0</Text>}
          />
          <View style={s.divider} />
          <SettingRow
            icon="phone-portrait"
            title="Platform"
            rightElement={
              <Text style={s.versionText}>
                {Platform.OS === "ios"
                  ? "iOS"
                  : Platform.OS === "android"
                    ? "Android"
                    : "Web"}
              </Text>
            }
          />
        </View>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },

  statsCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: {
    width: 0.5,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  statValue: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.black,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  sectionLine: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.sm,
  },
  sectionText: {
    fontSize: 11,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textPrimary,
  },
  rowSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.lg + 36 + SPACING.md,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusPillText: {
    fontSize: FONTS.sizes.xxs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },

  versionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
});
