/**
 * notificationService.js — NotifyMe
 *
 * TRIGGER FORMAT (expo-notifications ~0.32):
 * Every trigger MUST have a `type` field matching SchedulableTriggerInputTypes.
 *
 * Correct values:
 *   TIME_INTERVAL → type: 'timeInterval', seconds: N
 *   DAILY         → type: 'daily',        hour, minute
 *   WEEKLY        → type: 'weekly',       weekday, hour, minute
 *
 * TIMEZONE:
 * task.timeHour / task.timeMinute are plain local integers stored at save time.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CATEGORIES, REPEAT_TYPES } from "./theme";

const CHANNEL_ID = "notifyme_default_v1";
const CHANNEL_INIT_KEY = "notifyme_channel_default_v1";

const LEGACY_CHANNEL_IDS = [
  "notifyme_main",
  "notifyme_channel_v1",
  "notifyme_channel_v2",
  "notifyme_channel_v3",
  "default",
];

// ─── Handler ───────────────────────────────────────────────────────────────────
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Permissions ───────────────────────────────────────────────────────────────
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.warn("[NotifyMe] Physical device required for notifications.");
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("[NotifyMe] Notification permission denied.");
    return false;
  }
  if (Platform.OS === "android") await _ensureAndroidChannel();
  return true;
}

async function _ensureAndroidChannel() {
  try {
    const alreadyInit = await AsyncStorage.getItem(CHANNEL_INIT_KEY);
    if (!alreadyInit) {
      for (const id of LEGACY_CHANNEL_IDS) {
        await Notifications.deleteNotificationChannelAsync(id).catch(() => {});
      }
    }
    const existing =
      await Notifications.getNotificationChannelAsync(CHANNEL_ID);
    if (existing) {
      if (!alreadyInit) await AsyncStorage.setItem(CHANNEL_INIT_KEY, "1");
      return;
    }
    await _createAndroidChannel();
    await AsyncStorage.setItem(CHANNEL_INIT_KEY, "1");
  } catch (err) {
    console.error("[NotifyMe] Channel setup error:", err.message);
    await _createAndroidChannel().catch(() => {});
  }
}

async function _createAndroidChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "NotifyMe Reminders",
    description: "Task and event reminder alerts",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 300, 150, 400],
    enableLights: true,
    lightColor: "#0A84FF",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    bypassDnd: false,
  });
}

// ─── Content builder ───────────────────────────────────────────────────────────
// Emoji icons for notification (separate from Ionicons used in UI)
const CATEGORY_EMOJIS = {
  general: "🔵",
  work: "💼",
  health: "❤️",
  fitness: "💪",
  personal: "⭐",
  finance: "💳",
  study: "📚",
  social: "👥",
};

// Default body text per category — distinct from UI labels, kept here intentionally
const CATEGORY_BODIES = {
  work: "Time to focus and get this done.",
  health: "Your wellbeing comes first.",
  fitness: "Get moving — your body will thank you.",
  finance: "Stay on top of your finances.",
  study: "Knowledge is power. Time to learn.",
  social: "Stay connected with the people that matter.",
  personal: "A little reminder just for you.",
  general: "Tap to view your reminder.",
};

function getCategoryNotifMeta(categoryId) {
  // Derive label from the single CATEGORIES source in theme.js
  const cat = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  return {
    label: cat.label,
    emoji: CATEGORY_EMOJIS[cat.id] || "🔵",
    body: CATEGORY_BODIES[cat.id] || "Tap to view your reminder.",
  };
}

function buildContent(task) {
  const { label, emoji, body } = getCategoryNotifMeta(task.category);
  return {
    title: `${emoji} ${task.title}`,
    subtitle: label, // shown on iOS below the app name
    body: task.description?.trim() || body,
    sound: "default",
    data: { taskId: task.id, category: task.category },
  };
}

// ─── Cancel helpers ─────────────────────────────────────────────────────────────
/**
 * Cancel by stored IDs only — fast path, no full-scan on every schedule call.
 */
async function cancelByIds(notificationIds) {
  if (!notificationIds?.length) return;
  for (const nid of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
  }
}

/**
 * Full scan — cancel any notification tagged with this taskId.
 * Expensive; call only on launch cleanup or explicit data repair, not every schedule.
 *
 * TODO: Wire this up in a future "repair notifications" flow (e.g. Settings → Fix Notifications),
 * or call it during app init after loadTasks() as a one-time belt-and-suspenders cleanup
 * for users upgrading from older app versions that didn't reliably persist notificationIds.
 */
export async function cancelOrphanedNotificationsForTask(taskId) {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content?.data?.taskId === taskId) {
        await Notifications.cancelScheduledNotificationAsync(
          n.identifier,
        ).catch(() => {});
      }
    }
  } catch {
    // Non-critical cleanup — silently ignore
  }
}

// ─── Local time extraction ────────────────────────────────────────────────────
function getLocalDateInts(task) {
  const now = new Date();
  return {
    year: task.dateYear ?? now.getFullYear(),
    month: task.dateMonth ?? now.getMonth(),
    day: task.dateDay ?? now.getDate(),
  };
}

// ─── Main scheduler ────────────────────────────────────────────────────────────
export async function scheduleNotification(task) {
  // Fast cancel via stored IDs (avoids expensive getAllScheduledNotifications scan)
  await cancelByIds(task.notificationIds);

  const content = buildContent(task);
  const now = new Date();

  // channelId is only added on Android — must NOT appear on iOS
  const androidChannel =
    Platform.OS === "android" ? { channelId: CHANNEL_ID } : {};

  // Build list of all time slots: primary + additional
  const allTimes = [
    { hours: task.timeHour ?? 0, minutes: task.timeMinute ?? 0 },
    ...(task.additionalTimes || []).map((t) => ({
      hours: t.hour,
      minutes: t.minute,
    })),
  ];

  try {
    // ── DAILY ──────────────────────────────────────────────────────────────────
    if (task.repeatType === REPEAT_TYPES.DAILY) {
      const ids = [];
      for (const { hours, minutes } of allTimes) {
        const id = await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: "daily", hour: hours, minute: minutes, ...androidChannel },
        });
        ids.push(id);
        console.log(
          `[NotifyMe] DAILY scheduled at ${hours}:${String(minutes).padStart(2, "0")} — id: ${id}`,
        );
      }
      return ids;
    }

    // ── WEEKLY ─────────────────────────────────────────────────────────────────
    if (
      task.repeatType === REPEAT_TYPES.WEEKLY &&
      task.selectedDays?.length > 0
    ) {
      const ids = [];
      for (const { hours, minutes } of allTimes) {
        for (const day of task.selectedDays) {
          const id = await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: "weekly",
              weekday: day + 1,
              hour: hours,
              minute: minutes,
              ...androidChannel,
            },
          });
          ids.push(id);
        }
      }
      console.log(
        `[NotifyMe] WEEKLY scheduled on days [${task.selectedDays}] × ${allTimes.length} time(s) — ids: ${ids}`,
      );
      return ids;
    }

    // ── ONCE ───────────────────────────────────────────────────────────────────
    const { year, month, day } = getLocalDateInts(task);
    const ids = [];

    for (const { hours, minutes } of allTimes) {
      const fireAt = new Date(year, month, day, hours, minutes, 0, 0);

      if (fireAt <= now) {
        const isToday =
          year === now.getFullYear() &&
          month === now.getMonth() &&
          day === now.getDate();

        if (isToday) {
          fireAt.setDate(fireAt.getDate() + 1);
          console.log(
            `[NotifyMe] Time already passed today — rescheduled for tomorrow: ${fireAt.toLocaleString()}`,
          );
        } else {
          console.warn(
            `[NotifyMe] Past date selected, skipping: ${fireAt.toLocaleString()}`,
          );
          continue;
        }
      }

      const secondsUntilFire = Math.max(
        10,
        Math.round((fireAt.getTime() - now.getTime()) / 1000),
      );

      console.log(
        `[NotifyMe] ONCE → "${task.title}" fires at ${fireAt.toLocaleString()}` +
          ` — ${Math.round(secondsUntilFire / 60)} min from now (${secondsUntilFire}s)`,
      );

      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: "timeInterval",
          seconds: secondsUntilFire,
          repeats: false,
          ...androidChannel,
        },
      });
      ids.push(id);
      console.log(`[NotifyMe] Notification scheduled — id: ${id}`);
    }

    return ids;
  } catch (e) {
    console.error("[NotifyMe] scheduleNotification error:", e.message);
    return [];
  }
}

// ─── Cancel ────────────────────────────────────────────────────────────────────
export async function cancelNotification(notificationIds) {
  await cancelByIds(notificationIds);
}

// ─── Cancel all (web-safe) ─────────────────────────────────────────────────────
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    if (Platform.OS !== "web") console.error("cancelAllNotifications:", e);
  }
}

// ─── Test notification ─────────────────────────────────────────────────────────
export async function sendTestNotification() {
  const androidChannel =
    Platform.OS === "android" ? { channelId: CHANNEL_ID } : {};
  const greetings = [
    {
      title: "🔔  Hey, you've got a reminder!",
      body: "NotifyMe is set up and ready to keep you on track.",
    },
    {
      title: "✅  Notifications are live!",
      body: "Your reminders will show up right here, right on time.",
    },
    {
      title: "⏰  NotifyMe is watching the clock",
      body: "Sit back — we'll nudge you exactly when you need it.",
    },
  ];
  const pick = greetings[Math.floor(Math.random() * greetings.length)];
  return Notifications.scheduleNotificationAsync({
    content: {
      title: pick.title,
      body: pick.body,
      sound: "default",
      data: { test: true },
    },
    trigger: { type: "timeInterval", seconds: 5, repeats: false, ...androidChannel },
  });
}
