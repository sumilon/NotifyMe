/**
 * taskUtils.js — Shared task utility functions
 *
 * Single source of truth for task-related logic used across
 * TaskContext, HomeScreen, and anywhere else tasks are evaluated.
 */

import { REPEAT_TYPES } from "./theme";

/**
 * Returns true if a one-time task's fire time has already passed.
 * For multi-time tasks, "fired" means the LAST slot has passed.
 */
export function isOneTimeFired(task) {
  if (task.repeatType !== REPEAT_TYPES.ONCE) return false;
  if (task.timeHour === undefined || task.dateYear === undefined) return false;

  const allSlots = [
    { hour: task.timeHour, minute: task.timeMinute ?? 0 },
    ...(task.additionalTimes || []),
  ];

  const last = allSlots.reduce((a, b) =>
    b.hour * 60 + b.minute > a.hour * 60 + a.minute ? b : a,
  );

  const fireAt = new Date(
    task.dateYear,
    task.dateMonth,
    task.dateDay,
    last.hour,
    last.minute,
    0,
    0,
  );

  return fireAt <= new Date();
}

/**
 * Returns the next Date this task will fire, or null if it never will again.
 * Considers all time slots (primary + additionalTimes), repeat type, and weekday.
 */
export function getNextFireDate(task, now = new Date()) {
  if (!task.isActive) return null;

  const slots = [
    { hour: task.timeHour ?? 0, minute: task.timeMinute ?? 0 },
    ...(task.additionalTimes || []).map((t) => ({
      hour: t.hour,
      minute: t.minute,
    })),
  ];
  if (slots.length === 0) return null;

  // ── ONCE ──
  if (task.repeatType === REPEAT_TYPES.ONCE) {
    if (task.dateYear === undefined) return null;
    let earliest = null;
    for (const s of slots) {
      const d = new Date(
        task.dateYear,
        task.dateMonth,
        task.dateDay,
        s.hour,
        s.minute,
        0,
        0,
      );
      if (d > now && (!earliest || d < earliest)) earliest = d;
    }
    return earliest;
  }

  // ── DAILY ──
  if (task.repeatType === REPEAT_TYPES.DAILY) {
    let earliest = null;
    for (const s of slots) {
      let d = new Date(now);
      d.setHours(s.hour, s.minute, 0, 0);
      if (d <= now) {
        // Roll to tomorrow
        d.setDate(d.getDate() + 1);
      }
      if (!earliest || d < earliest) earliest = d;
    }
    return earliest;
  }

  // ── WEEKLY ──
  if (task.repeatType === REPEAT_TYPES.WEEKLY) {
    if (!task.selectedDays?.length) return null;
    let earliest = null;
    const todayDow = now.getDay();
    for (const s of slots) {
      for (const dow of task.selectedDays) {
        // How many days until that weekday (0..6)
        let dayOffset = (dow - todayDow + 7) % 7;
        let d = new Date(now);
        d.setDate(d.getDate() + dayOffset);
        d.setHours(s.hour, s.minute, 0, 0);
        // If it's today but the time already passed, push 7 days
        if (d <= now) d.setDate(d.getDate() + 7);
        if (!earliest || d < earliest) earliest = d;
      }
    }
    return earliest;
  }

  return null;
}
