import AsyncStorage from "@react-native-async-storage/async-storage";

const TASKS_KEY = "@notifyme_tasks";

/**
 * Migrates legacy tasks to the integer-based time/date format.
 * Old tasks stored `time` and `date` as UTC ISO strings, which caused
 * timezone bugs. New tasks use plain local integers (timeHour, timeMinute,
 * dateYear, dateMonth, dateDay). This migration runs once on load and
 * strips the legacy ISO fields entirely.
 *
 * Returns the same object reference if no migration was needed,
 * making it safe to check `m !== t` for change detection.
 */
function migrateTask(t) {
  if (!t) return t;

  const hasTimeInts =
    typeof t.timeHour === "number" && typeof t.timeMinute === "number";
  const hasDateInts = typeof t.dateYear === "number";
  const hasLegacyFields = "time" in t || "date" in t;

  // Fully migrated and clean — return same reference (no unnecessary array copy)
  if (hasTimeInts && (hasDateInts || t.repeatType !== "once") && !hasLegacyFields) {
    return t;
  }

  // Strip leftover ISO fields from an otherwise migrated task
  if (hasTimeInts && (hasDateInts || t.repeatType !== "once") && hasLegacyFields) {
    const { time: _t, date: _d, ...clean } = t;
    return clean;
  }

  // Full migration from ISO strings to local integers
  const { time: _legacyTime, date: _legacyDate, ...migrated } = t;

  if (!hasTimeInts && t.time) {
    const d = new Date(t.time);
    migrated.timeHour = d.getHours();
    migrated.timeMinute = d.getMinutes();
  }

  if (!hasDateInts && t.date) {
    const d = new Date(t.date);
    migrated.dateYear = d.getFullYear();
    migrated.dateMonth = d.getMonth();
    migrated.dateDay = d.getDate();
  }

  return migrated;
}

/**
 * Save tasks to AsyncStorage.
 * Returns true on success, false on failure (caller can surface a toast).
 */
export async function saveTasks(tasks) {
  try {
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    return true;
  } catch (e) {
    __DEV__ && console.error("Error saving tasks:", e);
    return false;
  }
}

export async function loadTasks() {
  try {
    const json = await AsyncStorage.getItem(TASKS_KEY);
    if (!json) return [];
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];

    let changed = false;
    const migrated = raw.map((t) => {
      const m = migrateTask(t);
      if (m !== t) changed = true;
      return m;
    });

    // Persist migrated form once so migration only runs on first load
    if (changed) {
      try {
        await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(migrated));
        __DEV__ && console.log("[NotifyMe] Migrated legacy task format → integer fields.");
      } catch (e) {
        __DEV__ && console.error("Migration save failed:", e);
      }
    }

    return migrated;
  } catch (e) {
    __DEV__ && console.error("Error loading tasks:", e);
    return [];
  }
}

export async function clearAllTasks() {
  try {
    await AsyncStorage.removeItem(TASKS_KEY);
    return true;
  } catch (e) {
    __DEV__ && console.error("Error clearing tasks:", e);
    return false;
  }
}
