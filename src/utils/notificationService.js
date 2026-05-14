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

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REPEAT_TYPES, getCategoryMeta } from './theme';

const CHANNEL_ID       = 'notifyme_default_v1';
const CHANNEL_INIT_KEY = 'notifyme_channel_default_v1';

const LEGACY_CHANNEL_IDS = [
  'notifyme_main', 'notifyme_channel_v1',
  'notifyme_channel_v2', 'notifyme_channel_v3', 'default',
];

// ─── Handler ───────────────────────────────────────────────────────────────────
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
}

// ─── Permissions ───────────────────────────────────────────────────────────────
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.warn('[NotifyMe] Physical device required for notifications.');
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[NotifyMe] Notification permission denied.');
    return false;
  }
  if (Platform.OS === 'android') await _ensureAndroidChannel();
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
    const existing = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
    if (existing) {
      if (!alreadyInit) await AsyncStorage.setItem(CHANNEL_INIT_KEY, '1');
      return;
    }
    await _createAndroidChannel();
    await AsyncStorage.setItem(CHANNEL_INIT_KEY, '1');
  } catch (err) {
    console.error('[NotifyMe] Channel setup error:', err.message);
    await _createAndroidChannel().catch(() => {});
  }
}

async function _createAndroidChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name:                 'NotifyMe Reminders',
    description:          'Task and event reminder alerts',
    importance:           Notifications.AndroidImportance.MAX,
    sound:                'default',
    enableVibrate:        true,
    vibrationPattern:     [0, 300, 150, 400],
    enableLights:         true,
    lightColor:           '#0A84FF',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge:            true,
    bypassDnd:            false,
  });
}

// ─── Content builder ───────────────────────────────────────────────────────────
function buildContent(task) {
  // Category emoji icons — rendered by the OS notification system
  const categoryIcon = {
    general:  '🔵',
    work:     '💼',
    health:   '❤️',
    fitness:  '💪',
    personal: '⭐',
    finance:  '💳',
    study:    '📚',
    social:   '👥',
  }[task.category] || '🔵';

  const categoryLabel = {
    general:  'General',
    work:     'Work',
    health:   'Health',
    fitness:  'Fitness',
    personal: 'Personal',
    finance:  'Finance',
    study:    'Study',
    social:   'Social',
  }[task.category] || 'Reminder';

  const defaultBody = {
    work:     'Time to focus and get this done.',
    health:   'Your wellbeing comes first.',
    fitness:  'Get moving — your body will thank you.',
    finance:  'Stay on top of your finances.',
    study:    'Knowledge is power. Time to learn.',
    social:   'Stay connected with the people that matter.',
    personal: 'A little reminder just for you.',
    general:  'Tap to view your reminder.',
  }[task.category] || 'Tap to view your reminder.';

  return {
    title:    `${categoryIcon} ${task.title}`,
    subtitle: categoryLabel,          // shown on iOS below the app name
    body:     task.description?.trim() || defaultBody,
    sound:    'default',
    // categoryIdentifier surfaces the category label on Android as a sub-text
    // (ignored on iOS where subtitle is used instead)
    data: {
      taskId:        task.id,
      category:      task.category,
      categoryLabel: categoryLabel,
      categoryIcon:  categoryIcon,
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
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  } catch {}
}

// ─── Local time extraction ──────────────────────────────────────────────────────
/**
 * Returns { hours, minutes } as LOCAL integers.
 * Prefers the explicit integers stored on save (timeHour / timeMinute).
 * Falls back to parsing the ISO string only for old tasks that lack them
 * (getHours() on a JS Date always returns local time, not UTC).
 */
function getLocalHourMinute(task) {
  if (typeof task.timeHour === 'number' && typeof task.timeMinute === 'number') {
    return { hours: task.timeHour, minutes: task.timeMinute };
  }
  // Legacy fallback
  const d = new Date(task.time);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

/**
 * Returns { year, month (0-based), day } as LOCAL integers.
 */
function getLocalDateInts(task) {
  if (
    typeof task.dateYear  === 'number' &&
    typeof task.dateMonth === 'number' &&
    typeof task.dateDay   === 'number'
  ) {
    return { year: task.dateYear, month: task.dateMonth, day: task.dateDay };
  }
  const d = task.date ? new Date(task.date) : new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

// ─── Main scheduler ────────────────────────────────────────────────────────────
export async function scheduleNotification(task) {
  await cancelExistingForTask(task);

  const content = buildContent(task);
  const now     = new Date();

  // channelId is only added on Android — it must NOT appear on iOS
  const androidChannel = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {};

  const { hours, minutes } = getLocalHourMinute(task);

  try {
    // ── DAILY ──────────────────────────────────────────────────────────────────
    if (task.repeatType === REPEAT_TYPES.DAILY) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: 'daily',   // ← required by expo-notifications 0.29+
          hour: hours,
          minute: minutes,
          ...androidChannel,
        },
      });
      console.log(`[NotifyMe] DAILY scheduled at ${hours}:${String(minutes).padStart(2,'0')} — id: ${id}`);
      return [id];
    }

    // ── WEEKLY ─────────────────────────────────────────────────────────────────
    if (task.repeatType === REPEAT_TYPES.WEEKLY && task.selectedDays?.length > 0) {
      const ids = [];
      for (const day of task.selectedDays) {
        const id = await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: 'weekly', // ← required
            weekday: day + 1, // expo weekday: 1=Sun … 7=Sat
            hour: hours,
            minute: minutes,
            ...androidChannel,
          },
        });
        ids.push(id);
      }
      console.log(`[NotifyMe] WEEKLY scheduled on days [${task.selectedDays}] — ids: ${ids}`);
      return ids;
    }

    // ── ONCE ───────────────────────────────────────────────────────────────────
    const { year, month, day } = getLocalDateInts(task);

    // Build fire instant entirely in LOCAL time — no UTC conversion
    const fireAt = new Date(year, month, day, hours, minutes, 0, 0);

    if (fireAt <= now) {
      const isToday =
        year  === now.getFullYear() &&
        month === now.getMonth()   &&
        day   === now.getDate();

      if (isToday) {
        // Same day but time already passed — push to tomorrow
        fireAt.setDate(fireAt.getDate() + 1);
        console.log(`[NotifyMe] Time already passed today — rescheduled for tomorrow: ${fireAt.toLocaleString()}`);
      } else {
        // A past date was picked — skip silently
        console.warn(`[NotifyMe] Past date selected, skipping: ${fireAt.toLocaleString()}`);
        return [];
      }
    }

    const secondsUntilFire = Math.max(10, Math.round((fireAt.getTime() - now.getTime()) / 1000));

    console.log(
      `[NotifyMe] ONCE → "${task.title}" fires at ${fireAt.toLocaleString()}` +
      ` — ${Math.round(secondsUntilFire / 60)} min from now (${secondsUntilFire}s)`
    );

    // ✅ CRITICAL: type: 'timeInterval' is REQUIRED.
    // Without it expo-notifications falls through to a channel-only trigger
    // which fires IMMEDIATELY on Android. This was the root cause of the bug.
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: 'timeInterval', // ← THIS is what was missing
        seconds: secondsUntilFire,
        repeats: false,
        ...androidChannel,
      },
    });

    console.log(`[NotifyMe] Notification scheduled — id: ${id}`);
    return [id];

  } catch (e) {
    console.error('[NotifyMe] scheduleNotification error:', e.message);
    return [];
  }
}

// ─── Cancel ────────────────────────────────────────────────────────────────────
export async function cancelNotification(notificationIds) {
  if (!notificationIds?.length) return;
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Test notification ─────────────────────────────────────────────────────────
export async function sendTestNotification() {
  const androidChannel = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {};
  const greetings = [
    { title: '🔔  Hey, you\'ve got a reminder!',    body: 'NotifyMe is set up and ready to keep you on track.' },
    { title: '✅  Notifications are live!',          body: 'Your reminders will show up right here, right on time.' },
    { title: '⏰  NotifyMe is watching the clock',  body: 'Sit back — we\'ll nudge you exactly when you need it.' },
  ];
  const pick = greetings[Math.floor(Math.random() * greetings.length)];
  return Notifications.scheduleNotificationAsync({
    content: { title: pick.title, body: pick.body, sound: 'default', data: { test: true } },
    trigger: {
      type: 'timeInterval', // ← required
      seconds: 5,
      repeats: false,
      ...androidChannel,
    },
  });
}

// ─── Channel reset (Settings utility) ─────────────────────────────────────────
export async function resetNotificationChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.deleteNotificationChannelAsync(CHANNEL_ID).catch(() => {});
    await AsyncStorage.removeItem(CHANNEL_INIT_KEY);
    await _createAndroidChannel();
    await AsyncStorage.setItem(CHANNEL_INIT_KEY, '1');
    console.log('[NotifyMe] Channel reset complete.');
  } catch (err) {
    console.error('[NotifyMe] Channel reset failed:', err.message);
  }
}

export async function getScheduledCount() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.length;
  } catch { return 0; }
}
