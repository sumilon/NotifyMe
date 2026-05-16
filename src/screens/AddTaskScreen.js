import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTasks } from "../context/TaskContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import SheetModal from "../components/SheetModal";
import TimePicker from "../components/TimePicker";
import DatePicker from "../components/DatePicker";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  REPEAT_TYPES,
  DAYS_OF_WEEK,
  CATEGORIES,
} from "../utils/theme";
import { hapticLight, hapticSuccess, hapticError } from "../utils/haptics";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function defaultTimeInts() {
  const d = new Date();
  // Round up to the next clean 15-minute boundary (e.g. 2:03 → 2:15, 2:51 → 3:00)
  // This feels intentional and avoids forcing the user to scroll past an odd time.
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  const rounded = Math.ceil((totalMinutes + 1) / 15) * 15; // +1 ensures we always move forward
  const hour = Math.floor(rounded / 60) % 24;
  const minute = rounded % 60;
  return { hour, minute };
}

function defaultDateInts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function timeDisplay12(hour, minute) {
  const p = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${p}`;
}

// ─── Constants (module-level — no recreation on render) ────────────────────────
const REPEATS = [
  {
    id: REPEAT_TYPES.ONCE,
    label: "One Time",
    sub: "Fires on the selected date",
    icon: "radio-button-on",
  },
  {
    id: REPEAT_TYPES.DAILY,
    label: "Every Day",
    sub: "Repeats at this time daily",
    icon: "sunny",
  },
  {
    id: REPEAT_TYPES.WEEKLY,
    label: "Specific Days",
    sub: "Choose days of the week",
    icon: "calendar",
  },
];

// ─── SectionLabel — extracted to avoid inline style objects on every render ────
function SectionLabel({ text, required }) {
  return (
    <View style={sl.row}>
      <View style={sl.line} />
      <Text style={sl.text}>{text}</Text>
      {required && <Text style={sl.star}>*</Text>}
    </View>
  );
}

const sl = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  line: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.sm,
  },
  text: {
    fontSize: 11,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  star: { color: COLORS.error, fontSize: FONTS.sizes.sm, marginLeft: 2 },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AddTaskScreen({ navigation, route }) {
  const { addTask, updateTask } = useTasks();
  const { showToast } = useToast();
  const editingTask = route?.params?.task || null;
  const isEditing = !!editingTask;

  // Initialise from editing task (always has integer fields post-migration)
  const [title, setTitle] = useState(editingTask?.title || "");
  const [description, setDescription] = useState(editingTask?.description || "");
  const [timeInts, setTimeInts] = useState(() =>
    isEditing
      ? { hour: editingTask.timeHour, minute: editingTask.timeMinute }
      : defaultTimeInts(),
  );
  const [additionalTimes, setAdditionalTimes] = useState(
    editingTask?.additionalTimes || [],
  );
  const [dateInts, setDateInts] = useState(() =>
    isEditing && editingTask.dateYear !== undefined
      ? { year: editingTask.dateYear, month: editingTask.dateMonth, day: editingTask.dateDay }
      : defaultDateInts(),
  );
  const [repeatType, setRepeatType] = useState(
    editingTask?.repeatType || REPEAT_TYPES.ONCE,
  );
  const [selectedDays, setSelectedDays] = useState(editingTask?.selectedDays || []);
  const [category, setCategory] = useState(editingTask?.category || "general");

  // timePickerIndex: null = primary time, number = index in additionalTimes
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerIndex, setTimePickerIndex] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorDialog, setErrorDialog] = useState(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // ─── Dirty tracking — snapshot of initial values to detect unsaved changes ───
  // Using a ref so comparisons don't trigger re-renders.
  // savedRef suppresses the back guard during the 900ms post-save delay before navigation fires.
  const savedRef = useRef(false);
  const initialValues = useRef({
    title: editingTask?.title || "",
    description: editingTask?.description || "",
    timeHour: isEditing ? editingTask.timeHour : null,
    timeMinute: isEditing ? editingTask.timeMinute : null,
    additionalTimes: editingTask?.additionalTimes || [],
    dateYear: isEditing ? editingTask.dateYear : null,
    dateMonth: isEditing ? editingTask.dateMonth : null,
    dateDay: isEditing ? editingTask.dateDay : null,
    repeatType: editingTask?.repeatType || REPEAT_TYPES.ONCE,
    selectedDays: editingTask?.selectedDays || [],
    category: editingTask?.category || "general",
  });

  // Lightweight array comparison — avoids JSON.stringify on every keystroke.
  // Checks length first (fast path), then each element by index.
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i], bi = b[i];
      if (typeof ai === "object" && ai !== null) {
        if (ai.hour !== bi?.hour || ai.minute !== bi?.minute) return false;
      } else if (ai !== bi) return false;
    }
    return true;
  }

  const isDirty = useMemo(() => {
    const iv = initialValues.current;
    // For new tasks: dirty if any real content entered
    if (!isEditing) {
      return (
        title.trim().length > 0 ||
        description.trim().length > 0 ||
        additionalTimes.length > 0 ||
        category !== "general" ||
        repeatType !== REPEAT_TYPES.ONCE ||
        selectedDays.length > 0
      );
    }
    // For edits: dirty if anything changed from original
    return (
      title !== iv.title ||
      description !== iv.description ||
      timeInts.hour !== iv.timeHour ||
      timeInts.minute !== iv.timeMinute ||
      !arraysEqual(additionalTimes, iv.additionalTimes) ||
      dateInts.year !== iv.dateYear ||
      dateInts.month !== iv.dateMonth ||
      dateInts.day !== iv.dateDay ||
      repeatType !== iv.repeatType ||
      !arraysEqual(selectedDays, iv.selectedDays) ||
      category !== iv.category
    );
  }, [
    isEditing, title, description, timeInts, additionalTimes,
    dateInts, repeatType, selectedDays, category,
  ]);

  // ─── Back guard — intercept hardware back (Android) and nav back ─────────────
  const handleBack = useCallback(() => {
    if (isDirty && !saving && !savedRef.current) {
      hapticLight();
      setDiscardConfirm(true);
      return true; // tells BackHandler we consumed the event
    }
    navigation.goBack();
    return true;
  }, [isDirty, saving, navigation]);

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => sub.remove();
  }, [handleBack]);

  const activeTimeInts =
    timePickerIndex === null
      ? timeInts
      : (additionalTimes[timePickerIndex] ?? timeInts);

  // Derived: is the selected date/time in the past?
  const isPast = useMemo(() => {
    if (repeatType !== REPEAT_TYPES.ONCE) return false;
    const fireAt = new Date(
      dateInts.year, dateInts.month, dateInts.day,
      timeInts.hour, timeInts.minute, 0, 0,
    );
    return fireAt <= new Date();
  }, [repeatType, dateInts, timeInts]);

  // Human-readable date label for the date picker button
  const dateLabel = useMemo(() => {
    const d = new Date(dateInts.year, dateInts.month, dateInts.day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }, [dateInts]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const openTimePicker = useCallback((index) => {
    setTimePickerIndex(index);
    setShowTimePicker(true);
  }, []);

  const handleTimeChange = useCallback(
    (h, m) => {
      if (timePickerIndex === null) {
        setTimeInts({ hour: h, minute: m });
      } else {
        setAdditionalTimes((prev) => {
          const updated = [...prev];
          updated[timePickerIndex] = { hour: h, minute: m };
          return updated;
        });
      }
    },
    [timePickerIndex],
  );

  const addExtraTime = useCallback(() => {
    hapticLight();
    setAdditionalTimes((prev) => {
      // Base the new slot off the last existing slot (primary or additional),
      // not off "now". Stagger by +15 min so slots are always ordered and spaced.
      // If the primary slot is available via timeInts, use it as the anchor for
      // the very first additional slot.
      const lastSlot = prev.length > 0 ? prev[prev.length - 1] : timeInts;
      const totalMinutes = lastSlot.hour * 60 + lastSlot.minute + 15;
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      return [...prev, { hour, minute }];
    });
  }, [timeInts]); // timeInts in dep so first extra slot anchors off primary

  const removeExtraTime = useCallback((index) => {
    hapticLight();
    setAdditionalTimes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleDay = useCallback((id) => {
    hapticLight();
    setSelectedDays((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }, []);

  const validate = useCallback(() => {
    if (!title.trim()) {
      setErrorDialog({
        icon: "pencil-outline",
        title: "Title Required",
        message: "Please enter a title for your reminder.",
      });
      return false;
    }
    if (repeatType === REPEAT_TYPES.WEEKLY && !selectedDays.length) {
      setErrorDialog({
        icon: "calendar-outline",
        title: "Select Days",
        message: "Choose at least one day of the week.",
      });
      return false;
    }
    if (repeatType === REPEAT_TYPES.ONCE && isPast) {
      setErrorDialog({
        icon: "alert-circle-outline",
        title: "Past Date & Time",
        message:
          "The selected date and time is in the past. Please choose a future time.",
      });
      return false;
    }
    return true;
  }, [title, repeatType, selectedDays, isPast]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      hapticError();
      return;
    }
    hapticLight();
    setSaving(true);

    const taskData = {
      ...(isEditing
        ? { id: editingTask.id, notificationIds: editingTask.notificationIds }
        : {}),
      title: title.trim(),
      description: description.trim(),
      timeHour: timeInts.hour,
      timeMinute: timeInts.minute,
      additionalTimes,
      dateYear: dateInts.year,
      dateMonth: dateInts.month,
      dateDay: dateInts.day,
      repeatType,
      selectedDays: repeatType === REPEAT_TYPES.WEEKLY ? selectedDays : [],
      category,
      isActive: isEditing ? editingTask.isActive : true,
    };

    try {
      if (isEditing) await updateTask(taskData);
      else await addTask(taskData);
      hapticSuccess();
      showToast(
        "success",
        isEditing ? "Reminder updated" : "Reminder created",
        title.trim(),
      );
      savedRef.current = true;
      setTimeout(() => navigation.goBack(), 900);
    } catch {
      hapticError();
      setErrorDialog({
        icon: "alert-circle-outline",
        title: "Failed",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [
    validate, isEditing, editingTask, title, description,
    timeInts, additionalTimes, dateInts, repeatType, selectedDays,
    category, addTask, updateTask, showToast, navigation,
  ]);

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
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

      <ConfirmDialog
        visible={discardConfirm}
        icon="arrow-back-outline"
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to go back?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        destructive
        onConfirm={() => {
          setDiscardConfirm(false);
          navigation.goBack();
        }}
        onCancel={() => setDiscardConfirm(false)}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={s.backBtn}
          activeOpacity={0.72}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isEditing ? "Edit Reminder" : "New Reminder"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <SectionLabel text="Title" required />
          <View style={s.inputCard}>
            <TextInput
              style={s.input}
              placeholder="e.g. Take medication"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="next"
            />
            <Text style={[
              s.charCount,
              title.length >= 72 && s.charCountWarn,
              title.length === 80 && s.charCountMax,
            ]}>
              {title.length}/80
            </Text>
          </View>

          {/* Description */}
          <SectionLabel text="Description" />
          <View style={s.inputCard}>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Optional details..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={250}
              multiline
              numberOfLines={2}
            />
            <Text style={[
              s.charCount,
              description.length >= 225 && s.charCountWarn,
              description.length === 250 && s.charCountMax,
            ]}>
              {description.length}/250
            </Text>
          </View>

          {/* Category */}
          <SectionLabel text="Category" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catRow}
            nestedScrollEnabled
          >
            {CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    s.catChip,
                    active && {
                      borderColor: cat.color,
                      backgroundColor: cat.color + "1C",
                    },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setCategory(cat.id);
                  }}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={active ? cat.color : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      s.catLabel,
                      { color: active ? cat.color : COLORS.textMuted },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Repeat */}
          <SectionLabel text="Repeat" />
          <View style={s.repeatList}>
            {REPEATS.map((opt, idx) => {
              const active = repeatType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    s.repeatRow,
                    active && s.repeatRowActive,
                    idx < REPEATS.length - 1 && s.repeatBorder,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setRepeatType(opt.id);
                  }}
                  activeOpacity={0.78}
                >
                  <View
                    style={[
                      s.repeatIconBox,
                      {
                        backgroundColor: active
                          ? COLORS.primary + "1C"
                          : COLORS.surfaceHigh,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? COLORS.primary : COLORS.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.repeatLabel,
                        active && { color: COLORS.textPrimary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={s.repeatSub}>{opt.sub}</Text>
                  </View>
                  <View
                    style={[
                      s.radioOuter,
                      active && { borderColor: COLORS.primary },
                    ]}
                  >
                    {active && <View style={s.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Day selector (weekly) */}
          {repeatType === REPEAT_TYPES.WEEKLY && (
            <>
              <SectionLabel text="Days" required />
              <View style={s.daysRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const sel = selectedDays.includes(day.id);
                  return (
                    <TouchableOpacity
                      key={day.id}
                      onPress={() => toggleDay(day.id)}
                      activeOpacity={0.78}
                    >
                      {sel ? (
                        <LinearGradient
                          colors={COLORS.gradientPrimary}
                          style={s.dayBtn}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Text
                            style={[
                              s.dayTxt,
                              { color: "#fff", fontWeight: FONTS.weights.bold },
                            ]}
                          >
                            {day.label}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View style={s.dayBtn}>
                          <Text style={s.dayTxt}>{day.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Date (one-time) */}
          {repeatType === REPEAT_TYPES.ONCE && (
            <>
              <SectionLabel text="Date" />
              <TouchableOpacity
                style={s.pickerCard}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.78}
              >
                <View
                  style={[s.pickerIconBox, { backgroundColor: COLORS.primary + "18" }]}
                >
                  <Ionicons name="calendar" size={18} color={COLORS.primary} />
                </View>
                <Text style={s.pickerText}>{dateLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </>
          )}

          {/* Primary time */}
          <SectionLabel text="Time" />
          <TouchableOpacity
            style={[s.pickerCard, isPast && s.pickerCardWarn]}
            onPress={() => openTimePicker(null)}
            activeOpacity={0.78}
          >
            <View
              style={[
                s.pickerIconBox,
                { backgroundColor: (isPast ? COLORS.warning : COLORS.primary) + "18" },
              ]}
            >
              <Ionicons
                name="time"
                size={18}
                color={isPast ? COLORS.warning : COLORS.primary}
              />
            </View>
            <Text style={[s.pickerText, isPast && { color: COLORS.warning }]}>
              {timeDisplay12(timeInts.hour, timeInts.minute)}
            </Text>
            {isPast ? (
              <Ionicons name="warning" size={16} color={COLORS.warning} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
          {isPast && (
            <Text style={s.warnText}>
              ⚠ This time is in the past — please choose a future time.
            </Text>
          )}

          {/* Additional times */}
          {additionalTimes.map((t, idx) => (
            <View key={idx} style={s.extraTimeRow}>
              <TouchableOpacity
                style={[s.pickerCard, s.extraTimeCard]}
                onPress={() => openTimePicker(idx)}
                activeOpacity={0.78}
              >
                <View
                  style={[s.pickerIconBox, { backgroundColor: COLORS.primary + "18" }]}
                >
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={s.pickerText}>
                  {timeDisplay12(t.hour, t.minute)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.removeTimeBtn}
                onPress={() => removeExtraTime(idx)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.error + "CC"} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add another time (max 5 total) */}
          {additionalTimes.length < 4 && (
            <TouchableOpacity
              style={s.addTimeBtn}
              onPress={addExtraTime}
              activeOpacity={0.78}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={s.addTimeTxt}>Add another time</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save footer */}
      <View style={s.footer}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={
              saving
                ? [COLORS.surfaceHigh, COLORS.surfaceHigh]
                : COLORS.gradientPrimary
            }
            style={s.saveBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {!saving && (
              <Ionicons
                name={isEditing ? "checkmark-circle" : "add-circle"}
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={s.saveTxt}>
              {saving
                ? "Saving..."
                : isEditing
                  ? "Update Reminder"
                  : "Create Reminder"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Time picker sheet */}
      <SheetModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        title={
          timePickerIndex === null ? "Select Time" : `Time ${timePickerIndex + 2}`
        }
      >
        <TimePicker
          hour={activeTimeInts.hour}
          minute={activeTimeInts.minute}
          onChange={handleTimeChange}
        />
      </SheetModal>

      {/* Date picker sheet */}
      <SheetModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title="Select Date"
      >
        <DatePicker
          dateYear={dateInts.year}
          dateMonth={dateInts.month}
          dateDay={dateInts.day}
          onChange={(y, mo, d) => {
            setDateInts({ year: y, month: mo, day: d });
            setShowDatePicker(false);
          }}
        />
      </SheetModal>
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
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },

  inputCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
  },
  input: { fontSize: FONTS.sizes.md, color: COLORS.textPrimary },
  inputMulti: { minHeight: 48, textAlignVertical: "top" },
  charCount: {
    fontSize: FONTS.sizes.xxs,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 6,
    fontWeight: FONTS.weights.medium,
  },
  charCountWarn: { color: COLORS.warning },
  charCountMax: { color: COLORS.error },

  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    gap: 7,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  catLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },

  repeatList: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  repeatRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  repeatRowActive: { backgroundColor: COLORS.primary + "08" },
  repeatBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  repeatIconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  repeatLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textMuted,
  },
  repeatSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 1 },

  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  dayTxt: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
  },

  pickerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.borderMid,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  pickerCardWarn: {
    borderColor: COLORS.warning + "55",
    backgroundColor: COLORS.warningMuted,
  },
  pickerIconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerText: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: -0.2,
  },
  warnText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    marginTop: SPACING.xs,
    paddingHorizontal: 2,
  },

  extraTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  extraTimeCard: { flex: 1 },
  removeTimeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addTimeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.primary + "08",
  },
  addTimeTxt: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },

  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  saveBtn: {
    flexDirection: "row",
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.blue,
  },
  saveTxt: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semibold,
    color: "#fff",
    letterSpacing: 0.1,
  },
});
