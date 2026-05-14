/**
 * notificationService.js — NotifyMe
 *
 * TRIGGER FORMAT (expo-notifications ~0.32):
 * Every trigger MUST have a `type` field matching SchedulableTriggerInputTypes.
 * Without `type`, the library falls through to a channel-only (immediate) trigger.
 *
 * Correct values:
 *   TIME_INTERVAL → type: 'timeInterval', seconds: N
 *   DAILY         → type: 'daily',        hour, minute
 *   WEEKLY        → type: 'weekly',       weekday, hour, minute
 *   DATE          → type: 'date',         date: <Date object>   (uses timestamp)
 *
 * TIMEZONE:
 * task.timeHour / task.timeMinute are plain local integers stored at save time.
 * We NEVER parse task.time (a UTC ISO string) for hour/minute extraction.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { REPEAT_TYPES } from "./theme";

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
const CATEGORY_ICONS = {
  general: "🔵",
  work: "💼",
  health: "❤️",
  fitness: "💪",
  personal: "⭐",
  finance: "💳",
  study: "📚",
  social: "👥",
};

const CATEGORY_LABELS = {
  general: "General",
  work: "Work",
  health: "Health",
  fitness: "Fitness",
  personal: "Personal",
  finance: "Finance",
  study: "Study",
  social: "Social",
};

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

function buildContent(task) {
  const categoryIcon = CATEGORY_ICONS[task.category] || "🔵";
  const categoryLabel = CATEGORY_LABELS[task.category] || "Reminder";
  const defaultBody =
    CATEGORY_BODIES[task.category] || "Tap to view your reminder.";

  return {
    title: `${categoryIcon} ${task.title}`,
    subtitle: categoryLabel, // shown on iOS below the app name
    body: task.description?.trim() || defaultBody,
    sound: "default",
    data: {
      taskId: task.id,
      category: task.category,
      categoryLabel: categoryLabel,
      categoryIcon: categoryIcon,
    },
  };
}

// ─── Cancel helpers ─────────────────────────────────────────────────────────────
async function cancelExistingForTask(task) {
  if (task.notificationIds?.length) {
    for (const nid of task.notificationIds) {
      await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
    }
  }
  // Belt-and-suspenders: also cancel any scheduled notifications tagged with this taskId
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content?.data?.taskId === task.id) {
        await Notifications.cancelScheduledNotificationAsync(
          n.identifier,
        ).catch(() => {});
      }
    }
  } catch {}
}

// ─── Local time extraction (clean — no ISO fallback after migration) ──────────
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
  await cancelExistingForTask(task);

  const content = buildContent(task);
  const now = new Date();

  // channelId is only added on Android — it must NOT appear on iOS
  const androidChannel =
    Platform.OS === "android" ? { channelId: CHANNEL_ID } : {};

  // Build a list of all time slots: primary + any additional
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
          trigger: {
            type: "daily",
            hour: hours,
            minute: minutes,
            ...androidChannel,
          },
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
      // Build fire instant entirely in LOCAL time — no UTC conversion
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
  if (!notificationIds?.length) return;
  for (const id of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore — web or already-cancelled
    }
  }
}

// ─── Cancel all (web-safe) ─────────────────────────────────────────────────────
export async function cancelAllNotifications() {
  try {
    // expo-notifications throws "not implemented" on web — swallow it
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
    trigger: {
      type: "timeInterval", // ← required
      seconds: 5,
      repeats: false,
      ...androidChannel,
    },
  });
}
