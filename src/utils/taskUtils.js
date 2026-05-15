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
