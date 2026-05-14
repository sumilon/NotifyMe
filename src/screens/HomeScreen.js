import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../context/TaskContext';
import { useToast } from '../context/ToastContext';
import { TaskCard, EmptyState, StatsBar } from '../components/TaskCard';
import ConfirmDialog from '../components/ConfirmDialog';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, getCategoryMeta, formatTaskTime } from '../utils/theme';

const CARD_HEIGHT = 110; // approx height for FlatList optimisation

export default function HomeScreen({ navigation }) {
  const { tasks, loading, toggleTask, deleteTask, permissionsGranted } = useTasks();
  const { showToast } = useToast();
  const [searchQuery,   setSearchQuery]   = useState('');
  const [filterActive,  setFilterActive]  = useState('all');
  const [sortBy,        setSortBy]        = useState('created'); // 'created' | 'time' | 'category'
  const [confirmState,  setConfirmState]  = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [firedExpanded, setFiredExpanded] = useState(false);
  const inputRef = useRef(null);

  // ── Helper: is a one-time task's fire time already in the past? ────────────
  const isFired = useCallback((t) => {
    if (t.repeatType !== 'once') return false;
    const now    = new Date();
    const fireAt = new Date(
      t.dateYear   ?? now.getFullYear(),
      t.dateMonth  ?? now.getMonth(),
      t.dateDay    ?? now.getDate(),
      t.timeHour   ?? 0,
      t.timeMinute ?? 0,
      0, 0,
    );
    return fireAt <= now;
  }, []);

  // ── Filtered + sorted tasks split into upcoming vs fired ───────────────────
  const { upcomingTasks, firedTasks } = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let result = tasks.filter(t => {
      const matchSearch = !q ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q);
      const matchFilter =
        filterActive === 'all' ||
        (filterActive === 'active'   &&  t.isActive) ||
        (filterActive === 'inactive' && !t.isActive);
      return matchSearch && matchFilter;
    });

    const sorter = (a, b) => {
      if (sortBy === 'time') {
        const aH = (a.timeHour ?? 0) * 60 + (a.timeMinute ?? 0);
        const bH = (b.timeHour ?? 0) * 60 + (b.timeMinute ?? 0);
        return aH - bH;
      }
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      const getTs = (t) => {
        if (t.createdAt) return new Date(t.createdAt).getTime();
        const parts = (t.id || '').split('_');
        const ts = parseInt(parts[1], 10);
        return isNaN(ts) ? 0 : ts;
      };
      return getTs(b) - getTs(a);
    };

    const upcoming = result.filter(t => !isFired(t)).sort(sorter);
    const fired    = result.filter(t =>  isFired(t)).sort((a, b) => {
      // most recently fired first
      const fa = new Date(a.dateYear ?? 0, a.dateMonth ?? 0, a.dateDay ?? 1, a.timeHour ?? 0, a.timeMinute ?? 0);
      const fb = new Date(b.dateYear ?? 0, b.dateMonth ?? 0, b.dateDay ?? 1, b.timeHour ?? 0, b.timeMinute ?? 0);
      return fb - fa;
    });

    return { upcomingTasks: upcoming, firedTasks: fired };
  }, [tasks, searchQuery, filterActive, sortBy, isFired]);

  // ── Stats computed once ─────────────────────────────────────────────────────
  const { activeCount, pausedCount } = useMemo(() => ({
    activeCount: tasks.filter(t =>  t.isActive).length,
    pausedCount: tasks.filter(t => !t.isActive).length,
  }), [tasks]);

  const FILTERS = useMemo(() => [
    { id: 'all',      label: 'All',    count: tasks.length },
    { id: 'active',   label: 'Active', count: activeCount  },
    { id: 'inactive', label: 'Paused', count: pausedCount  },
  ], [tasks.length, activeCount, pausedCount]);

  const SORTS = [
    { id: 'created',  label: 'Newest',   icon: 'sparkles'      },
    { id: 'time',     label: 'Time',     icon: 'alarm'         },
    { id: 'category', label: 'Category', icon: 'color-palette' },
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDeleteRequest = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    setConfirmState({ id, title: task?.title || 'this reminder' });
  }, [tasks]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmState) return;
    await deleteTask(confirmState.id);
    const title = confirmState.title;
    setConfirmState(null);
    showToast('warning', 'Deleted', title);
  }, [confirmState, deleteTask, showToast]);

  const handleToggle = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id);
    await toggleTask(id);
    showToast('info', task?.isActive ? 'Reminder paused' : 'Reminder active', task?.title);
  }, [tasks, toggleTask, showToast]);

  const handleEdit = useCallback((task) => navigation.navigate('AddTask', { task }), [navigation]);
  const handleAdd  = useCallback(() => navigation.navigate('AddTask', { task: null }), [navigation]);

  const renderTask = useCallback(({ item }) => (
    <TaskCard task={item} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDeleteRequest} />
  ), [handleToggle, handleEdit, handleDeleteRequest]);

  const keyExtractor = useCallback(item => item.id, []);

  const getItemLayout = useCallback((_data, index) => ({
    length: CARD_HEIGHT + 10,
    offset: (CARD_HEIGHT + 10) * index,
    index,
  }), []);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const ListEmpty = useMemo(() => {
    if (searchQuery) return (
      <View style={s.noResults}>
        <Ionicons name="search" size={36} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
        <Text style={s.noResultsTitle}>No results</Text>
        <Text style={s.noResultsSub}>for "{searchQuery}"</Text>
      </View>
    );
    if (filterActive === 'active') return (
      <View style={s.noResults}>
        <Ionicons name="checkmark-circle" size={42} color={COLORS.textMuted} style={{ marginBottom: 14 }} />
        <Text style={s.noResultsTitle}>No Active Reminders</Text>
        <Text style={s.noResultsSub}>All your reminders are paused{'\n'}or none have been created yet.</Text>
      </View>
    );
    if (filterActive === 'inactive') return (
      <View style={s.noResults}>
        <Ionicons name="pause-circle" size={42} color={COLORS.textMuted} style={{ marginBottom: 14 }} />
        <Text style={s.noResultsTitle}>No Paused Reminders</Text>
        <Text style={s.noResultsSub}>All your reminders are active{'\n'}and running on schedule.</Text>
      </View>
    );
    return <EmptyState onAdd={handleAdd} />;
  }, [searchQuery, filterActive, handleAdd]);

  // Fired section header — tappable to expand/collapse
  const FiredSectionHeader = firedTasks.length > 0 ? (
    <TouchableOpacity
      style={s.firedHeader}
      onPress={() => setFiredExpanded(v => !v)}
      activeOpacity={0.75}
    >
      <View style={s.firedHeaderLeft}>
        <View style={s.firedHeaderIconBox}>
          <Ionicons name="checkmark-done-outline" size={12} color={COLORS.textMuted} />
        </View>
        <Text style={s.firedHeaderText}>Fired Reminders</Text>
        <View style={s.firedBadge}>
          <Text style={s.firedBadgeText}>{firedTasks.length}</Text>
        </View>
      </View>
      <Ionicons
        name={firedExpanded ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={COLORS.textMuted}
      />
    </TouchableOpacity>
  ) : null;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
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
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn} activeOpacity={0.72}>
            <Ionicons name="options" size={19} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAdd} activeOpacity={0.85}>
            <LinearGradient colors={COLORS.gradientPrimary} style={s.addBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Permission banner — tapping opens system settings */}
      {!permissionsGranted && (
        <TouchableOpacity style={s.permBanner} activeOpacity={0.8} onPress={() => Linking.openSettings()}>
          <View style={s.permDot} />
          <Text style={s.permText}>Notifications disabled — tap to open Settings</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.warning} />
        </TouchableOpacity>
      )}

      {/* Stats */}
      {tasks.length > 0 && <StatsBar tasks={tasks} />}

      {/* Next Up highlight — show soonest upcoming task when not searching */}
      {!searchQuery && upcomingTasks.length > 0 && (() => {
        const next = upcomingTasks[0];
        const meta = getCategoryMeta(next.category);
        return (
          <TouchableOpacity
            style={s.nextUpBanner}
            onPress={() => handleEdit(next)}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={[meta.color + '22', meta.color + '0A']}
              style={s.nextUpGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={[s.nextUpIconBox, { backgroundColor: meta.color + '28' }]}>
                <Ionicons name={meta.icon} size={16} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nextUpLabel}>Next up</Text>
                <Text style={s.nextUpTitle} numberOfLines={1}>{next.title}</Text>
              </View>
              <View style={[s.nextUpTimePill, { backgroundColor: meta.color + '22', borderColor: meta.color + '40' }]}>
                <Ionicons name="time" size={11} color={meta.color} style={{ marginRight: 3 }} />
                <Text style={[s.nextUpTimeText, { color: meta.color }]}>{formatTaskTime(next)}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      })()}

      {/* Search */}
      <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
        <Ionicons name="search" size={16}
          color={searchFocused ? COLORS.primary : COLORS.textMuted} style={s.searchIcon} />
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
          <TouchableOpacity onPress={() => { setSearchQuery(''); inputRef.current?.blur(); }} style={s.clearBtn}>
            <View style={s.clearCircle}>
              <Ionicons name="close" size={10} color={COLORS.background} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter + Sort row */}
      <View style={s.controlRow}>
        <View style={s.segmentContainer}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[s.segment, filterActive === f.id && s.segmentActive]}
              onPress={() => setFilterActive(f.id)}
              activeOpacity={0.75}
            >
              <Text style={[s.segmentText, filterActive === f.id && s.segmentTextActive]}>{f.label}</Text>
              {f.count > 0 && (
                <View style={[s.segmentBadge, filterActive === f.id && s.segmentBadgeActive]}>
                  <Text style={[s.segmentBadgeText, filterActive === f.id && s.segmentBadgeTextActive]}>{f.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Sort pills */}
        <View style={s.sortRow}>
          {SORTS.map(so => (
            <TouchableOpacity
              key={so.id}
              style={[s.sortBtn, sortBy === so.id && s.sortBtnActive]}
              onPress={() => setSortBy(so.id)}
              activeOpacity={0.75}
            >
              <Ionicons name={so.icon} size={11} color={sortBy === so.id ? COLORS.primary : COLORS.textMuted} />
              <Text style={[s.sortText, sortBy === so.id && s.sortTextActive]}>{so.label}</Text>
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
          ListEmptyComponent={upcomingTasks.length === 0 && firedTasks.length === 0 ? ListEmpty : null}
          ListFooterComponent={
            <>
              {FiredSectionHeader}
              {firedExpanded && firedTasks.map(item => (
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
          }
          contentContainerStyle={[s.list, upcomingTasks.length === 0 && firedTasks.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
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

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  headerLeft:   {},
  greetingRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  greetingDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  greeting:     { fontSize: FONTS.sizes.xs, color: COLORS.success, fontWeight: FONTS.weights.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  headerTitle:  { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.black, color: COLORS.textPrimary, letterSpacing: -1, lineHeight: 36 },
  headerDate:   { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 1, fontWeight: FONTS.weights.medium },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingTop: 6 },

  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: COLORS.border },
  addBtn:  { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', ...SHADOWS.blue },

  permBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.warningMuted, borderRadius: RADIUS.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 0.5, borderColor: COLORS.warning + '35' },
  permDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.warning },
  permText:   { fontSize: FONTS.sizes.xs, color: COLORS.warning, flex: 1, fontWeight: FONTS.weights.medium },

  // Next Up banner
  nextUpBanner: { marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: COLORS.border },
  nextUpGrad:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm },
  nextUpIconBox:{ width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  nextUpLabel:  { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, fontWeight: FONTS.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1 },
  nextUpTitle:  { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  nextUpTimePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 0.5 },
  nextUpTimeText: { fontSize: FONTS.sizes.xxs, fontWeight: FONTS.weights.bold, letterSpacing: 0.3 },

  searchWrap:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 11, borderWidth: 0.5, borderColor: COLORS.border },
  searchWrapFocused: { borderColor: COLORS.primary + '55' },
  searchIcon:        { marginRight: 8 },
  searchInput:       { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.textPrimary, paddingVertical: 0 },
  clearBtn:          { padding: 2 },
  clearCircle:       { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.textMuted, alignItems: 'center', justifyContent: 'center' },

  controlRow: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md, gap: SPACING.sm },

  segmentContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 3, borderWidth: 0.5, borderColor: COLORS.border },
  segment:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: RADIUS.md, gap: 5 },
  segmentActive:    { backgroundColor: COLORS.surfaceElevated, ...SHADOWS.sm },
  segmentText:      { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  segmentTextActive:{ color: COLORS.textPrimary, fontWeight: FONTS.weights.semibold },
  segmentBadge:         { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.surfaceHigh, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  segmentBadgeActive:   { backgroundColor: COLORS.primary },
  segmentBadgeText:     { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold },
  segmentBadgeTextActive:{ color: '#fff' },

  sortRow:      { flexDirection: 'row', gap: SPACING.xs, flexShrink: 1 },
  sortBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.border },
  sortBtnActive:{ borderColor: COLORS.primary + '55', backgroundColor: COLORS.primaryMuted },
  sortText:     { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  sortTextActive:{ color: COLORS.primary },

  list:        { paddingTop: SPACING.xs, paddingBottom: SPACING.xxxl },
  loading:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },

  firedHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMid, borderWidth: 0.5, borderColor: COLORS.borderMid },
  firedHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  firedHeaderIconBox:{ width: 22, height: 22, borderRadius: RADIUS.xs, backgroundColor: COLORS.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  firedHeaderText:  { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  firedBadge:       { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.surfaceHigh, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  firedBadgeText:   { fontSize: FONTS.sizes.xxs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold },

  noResults:      { alignItems: 'center', paddingVertical: SPACING.xxxl * 2 },
  noResultsTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textSecondary },
  noResultsSub:   { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
