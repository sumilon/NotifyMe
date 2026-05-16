import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTasks } from "../context/TaskContext";
import { useToast } from "../context/ToastContext";
import { TaskCard, EmptyState, StatsBar } from "../components/TaskCard";
import ConfirmDialog from "../components/ConfirmDialog";
import NextUpBanner from "../components/NextUpBanner";
import { isOneTimeFired, getNextFireDate } from "../utils/taskUtils";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
} from "../utils/theme";
import { hapticLight, hapticMedium, hapticWarning } from "../utils/haptics";

const SORTS = [
  { id: "created", label: "Newest", icon: "sparkles" },
  { id: "time", label: "Time", icon: "alarm" },
  { id: "category", label: "Category", icon: "color-palette" },
];

// ─── Greeting helper ───────────────────────────────────────────────────────────
// Computed as a function (not a module-level constant) so it refreshes
// correctly if the app is left open past a time boundary.
function getGreetingInfo() {
  const hour = new Date().getHours();
  return {
    greeting:
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening",
    today: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
  };
}

// ─── FiredSectionHeader — extracted component so it's not JSX inside useMemo ──
const FiredSectionHeader = React.memo(function FiredSectionHeader({ count, expanded, onToggle, onClear }) {
  if (count === 0) return null;
  return (
    <TouchableOpacity
      style={s.firedHeader}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={s.firedHeaderLeft}>
        <View style={s.firedHeaderIconBox}>
          <Ionicons name="checkmark-done-outline" size={12} color={COLORS.textMuted} />
        </View>
        <Text style={s.firedHeaderText}>Fired Reminders</Text>
        <View style={s.firedBadge}>
          <Text style={s.firedBadgeText}>{count}</Text>
        </View>
      </View>
      <View style={s.firedHeaderRight}>
        {expanded && (
          <TouchableOpacity
            onPress={onClear}
            style={s.clearFiredBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={12} color={COLORS.error} />
            <Text style={s.clearFiredBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={COLORS.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
});

// ─── NoResults — extracted component ───────────────────────────────────────────
const NoResults = React.memo(function NoResults({ searchQuery, filterActive, onAdd }) {
  if (searchQuery) {
    return (
      <View style={s.noResults}>
        <Ionicons name="search" size={36} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
        <Text style={s.noResultsTitle}>No results</Text>
        <Text style={s.noResultsSub}>for "{searchQuery}"</Text>
      </View>
    );
  }
  if (filterActive === "active") {
    return (
      <View style={s.noResults}>
        <Ionicons name="checkmark-circle" size={42} color={COLORS.textMuted} style={{ marginBottom: 14 }} />
        <Text style={s.noResultsTitle}>No Active Reminders</Text>
        <Text style={s.noResultsSub}>
          All your reminders are paused{"\n"}or none have been created yet.
        </Text>
      </View>
    );
  }
  if (filterActive === "inactive") {
    return (
      <View style={s.noResults}>
        <Ionicons name="pause-circle" size={42} color={COLORS.textMuted} style={{ marginBottom: 14 }} />
        <Text style={s.noResultsTitle}>No Paused Reminders</Text>
        <Text style={s.noResultsSub}>
          All your reminders are active{"\n"}and running on schedule.
        </Text>
      </View>
    );
  }
  return <EmptyState onAdd={onAdd} />;
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const {
    tasks,
    loading,
    toggleTask,
    deleteTask,
    refreshTasks,
    clearFiredTasks,
    permissionsGranted,
  } = useTasks();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [confirmState, setConfirmState] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [firedExpanded, setFiredExpanded] = useState(false);
  const [clearFiredConfirm, setClearFiredConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // nowTick updates every 60s so time-sensitive memos (nextActiveBanner) always
  // use a fresh "now" even when the tasks array hasn't changed.
  const [nowTick, setNowTick] = useState(() => new Date());
  const inputRef = useRef(null);
  // tasksRef always holds the latest tasks so handlers don't need tasks in
  // their dep arrays — prevents renderTask from being recreated on every change.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // ─── Periodic tick — re-evaluate fired tasks every 60 s while screen is open ─
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTasks();
      setNowTick(new Date()); // advances nowTick → nextActiveBanner memo re-runs
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  // ─── Pull-to-refresh handler ─────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshTasks();
    setNowTick(new Date());
    setIsRefreshing(false);
  }, [refreshTasks]);

  // Memoized per-hour so greeting stays accurate if the app is open past a
  // time boundary, without recomputing on every render.
  const currentHour = new Date().getHours();
  const { greeting, today } = useMemo(() => getGreetingInfo(), [currentHour]);

  const { upcomingTasks, firedTasks } = useMemo(() => {
    const now = nowTick; // use the ticking clock so fired/upcoming split updates every 60s
    const q = searchQuery.toLowerCase();

    // ── Split fired vs upcoming FIRST, before any active/paused filter ──────
    // Fired ONCE tasks are always isActive:false (set by TaskContext), so
    // applying the active/paused filter before splitting caused fired tasks to
    // disappear from "All" or appear only in "Paused" — confusing. Splitting
    // first means the Fired section is always filter-independent.
    const allFired = tasks.filter((t) => isOneTimeFired(t));
    const allUpcoming = tasks.filter((t) => !isOneTimeFired(t));

    const matchesSearch = (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.category || "").toLowerCase().includes(q);

    // Upcoming: apply both search AND active/paused filter
    const filteredUpcoming = allUpcoming.filter((t) => {
      if (!matchesSearch(t)) return false;
      if (filterActive === "active") return t.isActive;
      if (filterActive === "inactive") return !t.isActive;
      return true; // "all"
    });

    // Fired: apply search only — active/paused filter does not apply
    const filteredFired = allFired.filter(matchesSearch);

    const sorter = (a, b) => {
      if (sortBy === "time") {
        // Use getNextFireDate for all types so ONCE, DAILY, and WEEKLY are all
        // compared by their actual next fire date — not just time-of-day.
        const na = getNextFireDate(a, now);
        const nb = getNextFireDate(b, now);
        // Tasks with no upcoming fire date (inactive/fired) sort to the end
        if (!na && !nb) return 0;
        if (!na) return 1;
        if (!nb) return -1;
        return na - nb;
      }
      if (sortBy === "category") {
        return (a.category || "").localeCompare(b.category || "");
      }
      // Default: newest first by createdAt or id timestamp
      const getTs = (t) => {
        if (t.createdAt) return new Date(t.createdAt).getTime();
        const parts = (t.id || "").split("_");
        const ts = parseInt(parts[1], 10);
        return isNaN(ts) ? 0 : ts;
      };
      return getTs(b) - getTs(a);
    };

    const firedSorter = (a, b) => {
      const fa = new Date(
        a.dateYear ?? 0, a.dateMonth ?? 0, a.dateDay ?? 1,
        a.timeHour ?? 0, a.timeMinute ?? 0,
      );
      const fb = new Date(
        b.dateYear ?? 0, b.dateMonth ?? 0, b.dateDay ?? 1,
        b.timeHour ?? 0, b.timeMinute ?? 0,
      );
      return fb - fa;
    };

    return {
      upcomingTasks: filteredUpcoming.sort(sorter),
      firedTasks: filteredFired.sort(firedSorter),
    };
  }, [tasks, searchQuery, filterActive, sortBy, nowTick]);

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

  const nextActiveBanner = useMemo(() => {
    const now = nowTick; // re-runs every 60s via nowTick, not just when tasks change
    let best = null;
    for (const t of tasks) {
      const next = getNextFireDate(t, now);
      if (!next) continue;
      if (!best || next < best.fireAt) best = { task: t, fireAt: next };
    }
    return best; // { task, fireAt } | null
  }, [tasks, nowTick]);

  const FILTERS = useMemo(
    () => [
      { id: "all", label: "All", count: tasks.length },
      { id: "active", label: "Active", count: activeCount },
      { id: "inactive", label: "Paused", count: pausedCount },
    ],
    [tasks.length, activeCount, pausedCount],
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleDeleteRequest = useCallback(
    (id) => {
      hapticLight();
      const task = tasksRef.current.find((t) => t.id === id);
      setConfirmState({ id, title: task?.title || "this reminder" });
    },
    [], // stable — reads live tasks via tasksRef
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmState) return;
    hapticWarning();
    await deleteTask(confirmState.id);
    const title = confirmState.title;
    setConfirmState(null);
    showToast("warning", "Deleted", title);
  }, [confirmState, deleteTask, showToast]);

  const handleToggle = useCallback(
    async (id) => {
      hapticLight();
      const task = tasksRef.current.find((t) => t.id === id);
      await toggleTask(id);
      showToast(
        "info",
        task?.isActive ? "Reminder paused" : "Reminder active",
        task?.title,
      );
    },
    [toggleTask, showToast], // stable — reads live tasks via tasksRef
  );

  const handleClearFiredConfirm = useCallback(async () => {
    hapticMedium();
    const count = firedTasks.length;
    await clearFiredTasks();
    setClearFiredConfirm(false);
    showToast("warning", "Cleared", `${count} fired reminder${count !== 1 ? "s" : ""} removed`);
  }, [firedTasks.length, clearFiredTasks, showToast]);

  const handleEdit = useCallback(
    (task) => {
      hapticLight();
      navigation.navigate("AddTask", { task });
    },
    [navigation],
  );

  const handleAdd = useCallback(() => {
    hapticLight();
    navigation.navigate("AddTask", { task: null });
  }, [navigation]);

  const handleFiredToggle = useCallback(() => {
    hapticLight();
    setFiredExpanded((v) => !v);
  }, []);

  const handleClearFiredRequest = useCallback(() => {
    hapticLight();
    setClearFiredConfirm(true);
  }, []);

  const renderTask = useCallback(
    ({ item }) => (
      <TaskCard
        task={item}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />
    ),
    [handleToggle, handleEdit, handleDeleteRequest],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const isListEmpty = upcomingTasks.length === 0 && firedTasks.length === 0;

  const ListFooter = useMemo(
    () => (
      <>
        <FiredSectionHeader
          count={firedTasks.length}
          expanded={firedExpanded}
          onToggle={handleFiredToggle}
          onClear={handleClearFiredRequest}
        />
        {firedExpanded &&
          firedTasks.map((item) => (
            <TaskCard
              key={item.id}
              task={item}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              fired
            />
          ))}
        <View style={{ height: SPACING.xxxl }} />
      </>
    ),
    [
      firedTasks,
      firedExpanded,
      handleFiredToggle,
      handleClearFiredRequest,
      handleToggle,
      handleEdit,
      handleDeleteRequest,
    ],
  );

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ConfirmDialog
        visible={!!confirmState}
        icon="trash"
        title="Delete Reminder?"
        message={`"${confirmState?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmState(null)}
      />

      <ConfirmDialog
        visible={clearFiredConfirm}
        icon="trash-bin"
        title="Clear All Fired?"
        message={`${firedTasks.length} fired reminder${firedTasks.length !== 1 ? "s" : ""} will be removed.`}
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleClearFiredConfirm}
        onCancel={() => setClearFiredConfirm(false)}
      />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.greetingRow}>
            <View style={s.greetingDot} />
            <Text style={s.greeting}>{greeting}</Text>
          </View>
          <Text style={s.headerTitle}>Reminders</Text>
          <Text style={s.headerDate}>{today}</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={s.iconBtn}
            activeOpacity={0.72}
          >
            <Ionicons name="options" size={19} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAdd} activeOpacity={0.85}>
            <LinearGradient
              colors={COLORS.gradientPrimary}
              style={s.addBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Permission banner */}
      {!permissionsGranted && (
        <TouchableOpacity
          style={s.permBanner}
          activeOpacity={0.8}
          onPress={() => Linking.openSettings()}
        >
          <View style={s.permDot} />
          <Text style={s.permText}>
            Notifications disabled — tap to open Settings
          </Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.warning} />
        </TouchableOpacity>
      )}

      {/* Stats */}
      {tasks.length > 0 && (
        <StatsBar
          total={tasks.length}
          active={activeCount}
          paused={pausedCount}
        />
      )}

      {/* Next Up */}
      {!searchQuery && nextActiveBanner && (
        <NextUpBanner
          task={nextActiveBanner.task}
          fireAt={nextActiveBanner.fireAt}
          onPress={handleEdit}
        />
      )}

      {/* Search */}
      <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
        <Ionicons
          name="search"
          size={16}
          color={searchFocused ? COLORS.primary : COLORS.textMuted}
          style={s.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={s.searchInput}
          placeholder="Search reminders..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {!!searchQuery && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery("");
              inputRef.current?.blur();
            }}
            style={s.clearBtn}
          >
            <View style={s.clearCircle}>
              <Ionicons name="close" size={10} color={COLORS.background} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter + Sort */}
      <View style={s.controlRow}>
        <View style={s.segmentContainer}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[s.segment, filterActive === f.id && s.segmentActive]}
              onPress={() => setFilterActive(f.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  s.segmentText,
                  filterActive === f.id && s.segmentTextActive,
                ]}
              >
                {f.label}
              </Text>
              {f.count > 0 && (
                <View
                  style={[
                    s.segmentBadge,
                    filterActive === f.id && s.segmentBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      s.segmentBadgeText,
                      filterActive === f.id && s.segmentBadgeTextActive,
                    ]}
                  >
                    {f.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.sortRow}>
          {SORTS.map((so) => (
            <TouchableOpacity
              key={so.id}
              style={[s.sortBtn, sortBy === so.id && s.sortBtnActive]}
              onPress={() => setSortBy(so.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={so.icon}
                size={11}
                color={sortBy === so.id ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[s.sortText, sortBy === so.id && s.sortTextActive]}>
                {so.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.loading}>
          <Ionicons name="hourglass" size={28} color={COLORS.textMuted} />
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={upcomingTasks}
          keyExtractor={keyExtractor}
          renderItem={renderTask}
          ListEmptyComponent={isListEmpty ? (
            <NoResults
              searchQuery={searchQuery}
              filterActive={filterActive}
              onAdd={handleAdd}
            />
          ) : null}
          ListFooterComponent={ListFooter}
          contentContainerStyle={[s.list, isListEmpty && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={10}
          initialNumToRender={12}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerLeft: {},
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  greetingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  greeting: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.black,
    color: COLORS.textPrimary,
    letterSpacing: -1,
    lineHeight: 36,
  },
  headerDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: 1,
    fontWeight: FONTS.weights.medium,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingTop: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.blue,
  },

  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.warningMuted,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: COLORS.warning + "35",
  },
  permDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  permText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    flex: 1,
    fontWeight: FONTS.weights.medium,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  searchWrapFocused: { borderColor: COLORS.primary + "55" },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2 },
  clearCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },

  controlRow: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 3,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 5,
  },
  segmentActive: { backgroundColor: COLORS.surfaceElevated, ...SHADOWS.sm },
  segmentText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  segmentTextActive: {
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  segmentBadgeActive: { backgroundColor: COLORS.primary },
  segmentBadgeText: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
  },
  segmentBadgeTextActive: { color: "#fff" },

  sortRow: { flexDirection: "row", gap: SPACING.xs, flexShrink: 1 },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  sortBtnActive: {
    borderColor: COLORS.primary + "55",
    backgroundColor: COLORS.primaryMuted,
  },
  sortText: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  sortTextActive: { color: COLORS.primary },

  list: { paddingTop: SPACING.xs, paddingBottom: SPACING.xxxl },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },

  firedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMid,
    borderWidth: 0.5,
    borderColor: COLORS.borderMid,
  },
  firedHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  firedHeaderIconBox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  firedHeaderText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  firedBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  firedBadgeText: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
  },
  firedHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  clearFiredBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.error + "15",
    borderWidth: 0.5,
    borderColor: COLORS.error + "35",
  },
  clearFiredBtnText: {
    fontSize: FONTS.sizes.xxs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.error,
    letterSpacing: 0.3,
  },

  noResults: { alignItems: "center", paddingVertical: SPACING.xxxl * 2 },
  noResultsTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
  },
  noResultsSub: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
});
