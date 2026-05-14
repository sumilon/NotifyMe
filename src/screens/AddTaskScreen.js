import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../context/TaskContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS,
  REPEAT_TYPES, DAYS_OF_WEEK, CATEGORIES, formatTaskTime,
} from '../utils/theme';

// ─── SheetModal ────────────────────────────────────────────────────────────────
function SheetModal({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={onClose} />
      <View style={ps.sheet}>
        <View style={ps.handle} />
        <View style={ps.sheetHeader}>
          <Text style={ps.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={ps.doneBtn}>
            <Text style={ps.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </Modal>
  );
}

// ─── TimePicker ────────────────────────────────────────────────────────────────
const ITEM_HEIGHT = 48;

/**
 * PickerCol — stable component defined OUTSIDE TimePicker so it never
 * remounts when the parent re-renders. A remount resets the ScrollView
 * position to 0, which was causing the "scrolls back to top" bug.
 *
 * Uses React.forwardRef so the parent can hold a ref to the ScrollView
 * and call scrollTo() for the initial-position snap on open.
 */
const PickerCol = React.forwardRef(function PickerCol(
  { data, selected, onSelect, label, fmt },
  ref,
) {
  return (
    <View style={ps.col}>
      <Text style={ps.colLabel}>{label}</Text>
      <ScrollView
        ref={ref}
        style={ps.colScroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        snapToAlignment="center"
      >
        {data.map((item, idx) => {
          const active = item === selected;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => {
                onSelect(item);
                // Smoothly snap the tapped row into view
                ref?.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
              }}
              style={[ps.colItem, active && ps.colItemActive]}
            >
              <Text style={[ps.colItemTxt, active && ps.colItemTxtActive]}>
                {fmt ? fmt(item) : String(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES  = Array.from({ length: 60 }, (_, i) => i);
const PERIODS  = ['AM', 'PM'];

function TimePicker({ hour, minute, onChange }) {
  const curPer = hour >= 12 ? 'PM' : 'AM';
  const curH12 = hour % 12 || 12;

  const hourRef = useRef(null);
  const minRef  = useRef(null);

  // On first open: scroll both columns so the current selection is visible.
  // Empty dep array — runs once when the picker mounts, not on every re-render.
  useEffect(() => {
    const hIdx = HOURS_12.indexOf(curH12);   // 0-based
    const mIdx = minute;                      // minute value == index in MINUTES
    setTimeout(() => {
      hourRef.current?.scrollTo({ y: hIdx * ITEM_HEIGHT, animated: false });
      minRef.current?.scrollTo({  y: mIdx * ITEM_HEIGHT, animated: false });
    }, 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (h12, min, period) => {
    let h = h12 % 12;
    if (period === 'PM') h += 12;
    onChange(h, min);
  };

  return (
    <View style={ps.timeRow}>
      <PickerCol
        ref={hourRef}
        data={HOURS_12}
        selected={curH12}
        label="Hour"
        fmt={h => String(h).padStart(2, '0')}
        onSelect={h => update(h, minute, curPer)}
      />
      <Text style={ps.sep}>:</Text>
      <PickerCol
        ref={minRef}
        data={MINUTES}
        selected={minute}
        label="Min"
        fmt={m => String(m).padStart(2, '0')}
        onSelect={m => update(curH12, m, curPer)}
      />
      <View style={ps.col}>
        <Text style={ps.colLabel}>Period</Text>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            onPress={() => update(curH12, minute, p)}
            style={[ps.colItem, curPer === p && ps.colItemActive]}
          >
            <Text style={[ps.colItemTxt, curPer === p && ps.colItemTxtActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── DatePicker ────────────────────────────────────────────────────────────────
function DatePicker({ dateYear, dateMonth, dateDay, onChange }) {
  const today = new Date();
  const days  = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  return (
    <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
      {days.map((d, i) => {
        const selected =
          d.getFullYear() === dateYear &&
          d.getMonth()    === dateMonth &&
          d.getDate()     === dateDay;
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return (
          <TouchableOpacity key={i}
            style={[ps.dateItem, selected && ps.colItemActive]}
            onPress={() => onChange(d.getFullYear(), d.getMonth(), d.getDate())}>
            <Text style={[ps.dateItemTxt, selected && ps.colItemTxtActive]}>{label}</Text>
            {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function defaultTimeInts() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function defaultDateInts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function timeDisplay12(hour, minute) {
  const p    = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${p}`;
}

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { backgroundColor: COLORS.surfaceElevated, borderTopLeftRadius: RADIUS.xxxl, borderTopRightRadius: RADIUS.xxxl, paddingBottom: 48, borderWidth: 0.5, borderColor: COLORS.border },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginTop: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  sheetTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  doneBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 7, borderRadius: RADIUS.full },
  doneTxt: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: '#fff' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.lg, gap: SPACING.sm },
  sep:     { fontSize: 26, color: COLORS.textPrimary, alignSelf: 'center', marginTop: 24, fontWeight: '200' },
  col:        { flex: 1 },
  colLabel:   { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1 },
  colScroll:  { maxHeight: 240 },
  colItem:    { height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  colItemActive:    { backgroundColor: COLORS.primary },
  colItemTxt:       { fontSize: FONTS.sizes.md, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  colItemTxtActive: { color: '#fff', fontWeight: FONTS.weights.bold },

  dateItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, marginHorizontal: SPACING.lg, marginBottom: 2 },
  dateItemTxt: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AddTaskScreen({ navigation, route }) {
  const { addTask, updateTask } = useTasks();
  const { showToast } = useToast();
  const editingTask = route?.params?.task || null;
  const isEditing   = !!editingTask;

  // Store time as plain integers (LOCAL hour 0-23, minute 0-59)
  // This avoids ALL UTC timezone issues — no Date objects involved in storage
  const initTimeInts = () => {
    if (isEditing) {
      if (editingTask.timeHour !== undefined) {
        return { hour: editingTask.timeHour, minute: editingTask.timeMinute };
      }
      // Legacy fallback: parse ISO but getHours() is local on JS engine
      const d = new Date(editingTask.time);
      return { hour: d.getHours(), minute: d.getMinutes() };
    }
    return defaultTimeInts();
  };

  const initDateInts = () => {
    if (isEditing) {
      if (editingTask.dateYear !== undefined) {
        return { year: editingTask.dateYear, month: editingTask.dateMonth, day: editingTask.dateDay };
      }
      const d = editingTask.date ? new Date(editingTask.date) : new Date();
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    }
    return defaultDateInts();
  };

  const [title,          setTitle]          = useState(editingTask?.title       || '');
  const [description,    setDescription]    = useState(editingTask?.description || '');
  const [timeInts,       setTimeInts]       = useState(initTimeInts);   // { hour, minute }
  const [dateInts,       setDateInts]       = useState(initDateInts);   // { year, month, day }
  const [repeatType,     setRepeatType]     = useState(editingTask?.repeatType  || REPEAT_TYPES.ONCE);
  const [selectedDays,   setSelectedDays]   = useState(editingTask?.selectedDays || []);
  const [category,       setCategory]       = useState(editingTask?.category    || 'general');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [errorDialog,    setErrorDialog]    = useState(null);

  const toggleDay = useCallback((id) => {
    setSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  }, []);

  const validate = () => {
    if (!title.trim()) {
      setErrorDialog({ icon: 'pencil-outline', title: 'Title Required', message: 'Please enter a title for your reminder.' });
      return false;
    }
    if (repeatType === REPEAT_TYPES.WEEKLY && !selectedDays.length) {
      setErrorDialog({ icon: 'calendar-outline', title: 'Select Days', message: 'Choose at least one day of the week.' });
      return false;
    }
    // Validate past date/time for one-time reminders
    if (repeatType === REPEAT_TYPES.ONCE) {
      const now    = new Date();
      const fireAt = new Date(
        dateInts.year, dateInts.month, dateInts.day,
        timeInts.hour, timeInts.minute, 0, 0,
      );
      if (fireAt <= now) {
        setErrorDialog({
          icon:    'alert-circle-outline',
          title:   'Past Date & Time',
          message: 'The selected date and time is in the past. Please choose a future time for your reminder.',
        });
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    // Build a dummy Date object only for the ISO string (legacy compat storage)
    // The real scheduling uses timeInts/dateInts directly — no UTC ambiguity
    const isoTimeRef = new Date(
      dateInts.year, dateInts.month, dateInts.day,
      timeInts.hour, timeInts.minute, 0, 0,
    );

    const taskData = {
      ...(isEditing ? { id: editingTask.id, notificationIds: editingTask.notificationIds } : {}),
      title: title.trim(),
      description: description.trim(),
      // Legacy ISO fields (kept for backward compat, NOT used for scheduling)
      time: isoTimeRef.toISOString(),
      date: isoTimeRef.toISOString(),
      // ✅ These are the canonical fields used by the scheduler and display — always local
      timeHour:   timeInts.hour,
      timeMinute: timeInts.minute,
      dateYear:   dateInts.year,
      dateMonth:  dateInts.month,
      dateDay:    dateInts.day,
      repeatType,
      selectedDays: repeatType === REPEAT_TYPES.WEEKLY ? selectedDays : [],
      category,
      isActive: isEditing ? editingTask.isActive : true,
    };

    try {
      if (isEditing) await updateTask(taskData);
      else           await addTask(taskData);
      showToast('success', isEditing ? 'Reminder updated' : 'Reminder created', title.trim());
      setTimeout(() => navigation.goBack(), 900);
    } catch {
      setErrorDialog({ icon: 'alert-circle-outline', title: 'Failed', message: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const REPEATS = [
    { id: REPEAT_TYPES.ONCE,   label: 'One Time',      sub: 'Fires on the selected date', icon: 'radio-button-on'  },
    { id: REPEAT_TYPES.DAILY,  label: 'Every Day',     sub: 'Repeats at this time daily',  icon: 'sunny'            },
    { id: REPEAT_TYPES.WEEKLY, label: 'Specific Days', sub: 'Choose days of the week',     icon: 'calendar'         },
  ];

  const dateLabel = (() => {
    const d = new Date(dateInts.year, dateInts.month, dateInts.day);
    const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  })();

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ConfirmDialog
        visible={!!errorDialog}
        icon={errorDialog?.icon}
        title={errorDialog?.title}
        message={errorDialog?.message}
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setErrorDialog(null)}
        onCancel={() => setErrorDialog(null)}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.72}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? 'Edit Reminder' : 'New Reminder'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <SectionLabel text="Title" required />
          <View style={s.inputCard}>
            <TextInput style={s.input} placeholder="e.g. Take medication"
              placeholderTextColor={COLORS.textMuted}
              value={title} onChangeText={setTitle} maxLength={80} returnKeyType="next" />
          </View>

          <SectionLabel text="Description" />
          <View style={s.inputCard}>
            <TextInput style={[s.input, s.inputMulti]} placeholder="Optional details..."
              placeholderTextColor={COLORS.textMuted}
              value={description} onChangeText={setDescription}
              maxLength={250} multiline numberOfLines={2} />
          </View>

          <SectionLabel text="Category" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {CATEGORIES.map(cat => {
              const active = category === cat.id;
              return (
                <TouchableOpacity key={cat.id}
                  style={[s.catChip, active && { borderColor: cat.color, backgroundColor: cat.color + '1C' }]}
                  onPress={() => setCategory(cat.id)} activeOpacity={0.78}>
                  <Ionicons name={cat.icon} size={14} color={active ? cat.color : COLORS.textMuted} />
                  <Text style={[s.catLabel, { color: active ? cat.color : COLORS.textMuted }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <SectionLabel text="Repeat" />
          <View style={s.repeatList}>
            {REPEATS.map((opt, idx) => {
              const active = repeatType === opt.id;
              return (
                <TouchableOpacity key={opt.id}
                  style={[s.repeatRow, active && s.repeatRowActive, idx < REPEATS.length - 1 && s.repeatBorder]}
                  onPress={() => setRepeatType(opt.id)} activeOpacity={0.78}>
                  <View style={[s.repeatIconBox, { backgroundColor: active ? COLORS.primary + '1C' : COLORS.surfaceHigh }]}>
                    <Ionicons name={opt.icon} size={16} color={active ? COLORS.primary : COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.repeatLabel, active && { color: COLORS.textPrimary }]}>{opt.label}</Text>
                    <Text style={s.repeatSub}>{opt.sub}</Text>
                  </View>
                  <View style={[s.radioOuter, active && { borderColor: COLORS.primary }]}>
                    {active && <View style={s.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {repeatType === REPEAT_TYPES.WEEKLY && (
            <>
              <SectionLabel text="Days" required />
              <View style={s.daysRow}>
                {DAYS_OF_WEEK.map(day => {
                  const sel = selectedDays.includes(day.id);
                  return (
                    <TouchableOpacity key={day.id} onPress={() => toggleDay(day.id)} activeOpacity={0.78}>
                      {sel ? (
                        <LinearGradient colors={COLORS.gradientPrimary} style={s.dayBtn}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Text style={[s.dayTxt, { color: '#fff', fontWeight: FONTS.weights.bold }]}>{day.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={s.dayBtn}><Text style={s.dayTxt}>{day.label}</Text></View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {repeatType === REPEAT_TYPES.ONCE && (
            <>
              <SectionLabel text="Date" />
              <TouchableOpacity style={s.pickerCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.78}>
                <View style={[s.pickerIconBox, { backgroundColor: COLORS.primary + '18' }]}>
                  <Ionicons name="calendar" size={18} color={COLORS.primary} />
                </View>
                <Text style={s.pickerText}>{dateLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <SectionLabel text="Time" />
          {(() => {
            const fireAt = new Date(
              dateInts.year, dateInts.month, dateInts.day,
              timeInts.hour, timeInts.minute, 0, 0,
            );
            const isPast = repeatType === REPEAT_TYPES.ONCE && fireAt <= new Date();
            return (
              <>
                <TouchableOpacity style={[s.pickerCard, isPast && s.pickerCardWarn]} onPress={() => setShowTimePicker(true)} activeOpacity={0.78}>
                  <View style={[s.pickerIconBox, { backgroundColor: (isPast ? COLORS.warning : COLORS.primary) + '18' }]}>
                    <Ionicons name="time" size={18} color={isPast ? COLORS.warning : COLORS.primary} />
                  </View>
                  <Text style={[s.pickerText, isPast && { color: COLORS.warning }]}>{timeDisplay12(timeInts.hour, timeInts.minute)}</Text>
                  {isPast && <Ionicons name="warning" size={16} color={COLORS.warning} />}
                  {!isPast && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
                </TouchableOpacity>
                {isPast && (
                  <Text style={s.warnText}>⚠ This time is in the past — please choose a future time.</Text>
                )}
              </>
            );
          })()}

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.footer}>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.88}>
          <LinearGradient
            colors={saving ? [COLORS.surfaceHigh, COLORS.surfaceHigh] : COLORS.gradientPrimary}
            style={s.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {!saving && <Ionicons name={isEditing ? 'checkmark-circle' : 'add-circle'} size={20} color="#fff" style={{ marginRight: 8 }} />}
            <Text style={s.saveTxt}>{saving ? 'Saving...' : isEditing ? 'Update Reminder' : 'Create Reminder'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <SheetModal visible={showTimePicker} onClose={() => setShowTimePicker(false)} title="Select Time">
        <TimePicker
          hour={timeInts.hour}
          minute={timeInts.minute}
          onChange={(h, m) => setTimeInts({ hour: h, minute: m })}
        />
      </SheetModal>

      <SheetModal visible={showDatePicker} onClose={() => setShowDatePicker(false)} title="Select Date">
        <DatePicker
          dateYear={dateInts.year}
          dateMonth={dateInts.month}
          dateDay={dateInts.day}
          onChange={(y, mo, d) => { setDateInts({ year: y, month: mo, day: d }); setShowDatePicker(false); }}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

function SectionLabel({ text, required }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.sm }}>
      <View style={s.labelLine} />
      <Text style={s.label}>{text}</Text>
      {required && <Text style={{ color: COLORS.error, fontSize: FONTS.sizes.sm, marginLeft: 2 }}>*</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: COLORS.border },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, letterSpacing: -0.3 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },

  labelLine: { width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.primary, marginRight: SPACING.sm },
  label: { fontSize: 11, fontWeight: FONTS.weights.bold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2 },

  inputCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, paddingVertical: 14 },
  input:      { fontSize: FONTS.sizes.md, color: COLORS.textPrimary },
  inputMulti: { minHeight: 48, textAlignVertical: 'top' },

  catRow:  { gap: SPACING.sm, paddingBottom: SPACING.sm, paddingHorizontal: 2 },
  catChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 13, gap: 7, borderWidth: 0.5, borderColor: COLORS.border, minWidth: 88 },
  catLabel:{ fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },

  repeatList:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  repeatRow:       { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  repeatRowActive: { backgroundColor: COLORS.primary + '08' },
  repeatBorder:    { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  repeatIconBox:   { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  radioOuter:      { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioInner:      { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  repeatLabel:     { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium, color: COLORS.textMuted },
  repeatSub:       { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },

  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBtn:  { width: 43, height: 43, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: COLORS.border },
  dayTxt:  { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: FONTS.weights.semibold },

  pickerCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 0.5, borderColor: COLORS.borderMid, padding: SPACING.lg, gap: SPACING.md },
  pickerCardWarn:{ borderColor: COLORS.warning + '55', backgroundColor: COLORS.warningMuted },
  pickerIconBox: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  pickerText:    { flex: 1, fontSize: FONTS.sizes.lg, color: COLORS.textPrimary, fontWeight: FONTS.weights.semibold, letterSpacing: -0.2 },
  warnText:      { fontSize: FONTS.sizes.xs, color: COLORS.warning, marginTop: SPACING.xs, paddingHorizontal: 2 },

  footer:  { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  saveBtn: { flexDirection: 'row', borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', ...SHADOWS.blue },
  saveTxt: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: '#fff', letterSpacing: 0.1 },
});
