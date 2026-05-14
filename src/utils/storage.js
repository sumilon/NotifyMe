import AsyncStorage from "@react-native-async-storage/async-storage";

const TASKS_KEY = "@notifyme_tasks";

/**
 * Migrates legacy tasks to the integer-based time/date format.
 * Old tasks stored `time` and `date` as UTC ISO strings, which caused
 * timezone bugs. New tasks use plain local integers (timeHour, timeMinute,
 * dateYear, dateMonth, dateDay). This migration runs once on load and
 * strips the legacy ISO fields entirely.
 */
function migrateTask(t) {
  if (!t) return t;
  const hasIntegers =
    typeof t.timeHour === "number" && typeof t.timeMinute === "number";
  const hasDateInts = typeof t.dateYear === "number";

  // Already migrated → strip any leftover ISO fields just in case
  if (hasIntegers && (hasDateInts || t.repeatType !== "once")) {
    if (t.time === undefined && t.date === undefined) return t; // truly clean
    const { time, date, ...clean } = t;
    return clean;
  }

  const migrated = { ...t };

  // Migrate time
  if (!hasIntegers && t.time) {
    const d = new Date(t.time);
    migrated.timeHour = d.getHours();
    migrated.timeMinute = d.getMinutes();
  }

  // Migrate date (only meaningful for one-time)
  if (!hasDateInts && t.date) {
    const d = new Date(t.date);
    migrated.dateYear = d.getFullYear();
    migrated.dateMonth = d.getMonth();
    migrated.dateDay = d.getDate();
  }

  // Strip legacy ISO fields
  delete migrated.time;
  delete migrated.date;
  return migrated;
}

/**
 * Save tasks to AsyncStorage.
 * Returns true on success, false on failure (so caller can surface a toast).
 */
export async function saveTasks(tasks) {
  try {
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    return true;
  } catch (e) {
    console.error("Error saving tasks:", e);
    return false;
  }
}

export async function loadTasks() {
  try {
    const json = await AsyncStorage.getItem(TASKS_KEY);
    if (!json) return [];
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];

    // Run migration & detect if anything changed
    let changed = false;
    const migrated = raw.map((t) => {
      const m = migrateTask(t);
      if (m !== t) changed = true;
      return m;
    });

    // Persist migrated form so the migration runs only once
    if (changed) {
      try {
        await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(migrated));
        console.log("[NotifyMe] Migrated legacy task format → integer fields.");
      } catch (e) {
        console.error("Migration save failed:", e);
      }
    }

    return migrated;
  } catch (e) {
    console.error("Error loading tasks:", e);
    return [];
  }
}

export async function clearAllTasks() {
  try {
    await AsyncStorage.removeItem(TASKS_KEY);
    return true;
  } catch (e) {
    console.error("Error clearing tasks:", e);
    return false;
  }
}
