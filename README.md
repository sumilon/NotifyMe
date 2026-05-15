# 🔔 NotifyMe — Smart Reminder App

A professional, lightweight task reminder app built with **Expo + React Native**.
Set reminders by category, get push notifications with sound — even when the app is closed.

---

## 📁 Project Structure

```
NotifyMe/
├── App.js                              ← Root: navigation + notification listeners
├── app.json                            ← Expo config: name, icons, permissions
├── package.json                        ← Dependencies
├── babel.config.js                     ← Babel transpiler config
├── eas.json                            ← EAS build profiles (APK / AAB)
├── assets/
│   ├── icon.png                        ← App icon 1024×1024 (home screen)
│   ├── adaptive-icon.png               ← Android adaptive icon 1024×1024
│   ├── splash.png                      ← Splash/loading screen
│   ├── favicon.png                     ← Browser tab icon 64×64
│   └── notification-icon.png           ← Android notification bar icon 96×96
└── src/
    ├── components/
    │   ├── TaskCard.js                 ← Reminder card, EmptyState, StatsBar (memoized)
    │   ├── NextUpBanner.js             ← "Next up" banner for the soonest active reminder (memoized)
    │   ├── ConfirmDialog.js            ← In-app themed confirm/alert dialog
    │   ├── Toast.js                    ← Slide-in feedback toast
    │   ├── SheetModal.js               ← Bottom sheet wrapper
    │   ├── TimePicker.js               ← Scroll-wheel time picker
    │   └── DatePicker.js               ← Scroll-wheel date picker
    ├── context/
    │   ├── TaskContext.js              ← Global state: tasks, CRUD, permissions, AppState sync
    │   └── ToastContext.js             ← Global toast queue
    ├── screens/
    │   ├── HomeScreen.js               ← Main list, search, filter, sort
    │   ├── AddTaskScreen.js            ← Create / edit form with unsaved-changes guard
    │   └── SettingsScreen.js           ← Settings, test notification, clear all
    └── utils/
        ├── notificationService.js      ← Scheduling, cancellation, Android channel setup
        ├── storage.js                  ← AsyncStorage read/write + legacy data migration
        ├── taskUtils.js                ← Shared task logic (isOneTimeFired, etc.)
        ├── haptics.js                  ← Haptic feedback wrapper (web-safe)
        └── theme.js                    ← Colors, fonts, spacing, categories, shadows
```

---

## ✨ Features

- Create reminders with title, description, category, and time
- Multiple time slots per reminder (e.g. 9 AM and 6 PM for the same task)
- One-time, Daily, or Weekly (specific days) repeat modes
- 8 categories: General, Work, Health, Fitness, Personal, Finance, Study, Social
- Push notifications that fire even when the app is closed
- Meaningful notification body per category when no description is provided
- Search and filter reminders (All / Active / Paused) with sort (Newest / Time / Category)
- "Next Up" banner showing the soonest upcoming active reminder
- Toggle reminders on/off without deleting
- Fired one-time reminders move to a collapsible "Fired" section
- Unsaved-changes guard when leaving the Add/Edit screen
- In-app Toast feedback — no native alert popups
- In-app ConfirmDialog for destructive actions
- Stats bar: Total / Active / Paused
- Permission banner with tap-to-open-Settings when notifications are disabled
- Badge count cleared automatically when app comes to foreground
- Works on Android and iOS (web supported with reduced notification functionality)

---

## 🏗 Architecture Notes

### State management
All task state lives in `TaskContext` using `useReducer`. A `stateRef` keeps callbacks reading the latest state without re-subscribing, keeping `useCallback` dependency arrays minimal and preventing stale-closure bugs.

### Data format
Tasks store time and date as plain local integers (`timeHour`, `timeMinute`, `dateYear`, `dateMonth`, `dateDay`) rather than ISO strings. This avoids timezone bugs. `storage.js` automatically migrates older tasks on first load.

### Notifications
`notificationService.js` cancels existing notification IDs before rescheduling (fast path, no full scan). Android channel setup is idempotent — old legacy channels are cleaned up on first run.

### Performance
`NextUpBanner` and `StatsBar` are wrapped in `React.memo`. `StatsBar` receives pre-computed counts (`total`, `active`, `paused`) from `HomeScreen` rather than the raw task array, avoiding duplicate filter passes.

---

## 🛠 Prerequisites

```bash
# Node.js v18+
node --version

# Expo CLI
npm install -g expo-cli

# EAS CLI (for building APK/AAB)
npm install -g eas-cli
```

Install **Expo Go** on your phone for development testing:
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent
- iOS: https://apps.apple.com/app/expo-go/id982107779

---

## 🚀 Running Locally

### Step 1 — Install dependencies

```bash
cd NotifyMe
npm install
```

### Step 2 — Start the dev server

```bash
# Mobile testing via Expo Go
npx expo start

# Web browser only
npx expo start --web

# Clear cache if something looks wrong
npx expo start --clear
```

### Step 3 — Open on your phone

**Android:** Open Expo Go → tap "Scan QR Code" → scan the terminal QR code

**iOS:** Open Camera → scan the QR → tap the banner → opens in Expo Go

> Both your phone and PC must be on the same Wi-Fi network.
> If on a network that blocks device-to-device traffic, share your phone's hotspot and connect your PC to it.

### Step 4 — Allow notifications

Tap **Allow** when prompted on first launch.

### Step 5 — Test notifications

**Settings → Send Test Notification** → lock your screen → notification fires in 5 seconds.

---

## 🔊 Notification Sound

### Expo Go vs your own APK

| Environment | Notifications | Sound |
|------------|--------------|-------|
| Expo Go    | ✅ Works      | ⚠️ System default only |
| Your APK   | ✅ Works      | ✅ Works |

Custom sounds are compiled into your own APK by EAS — Expo Go cannot access them. This is a platform limitation, not a code bug. The app uses `sound: 'default'` which works in both environments.

### Android sound flow

```
1. A notification channel is created on first launch (id: notifyme_default_v1)
2. Legacy channels from older versions are deleted to prevent stale config
3. Every scheduled notification includes the channelId in its trigger
4. Android routes through that channel and plays the sound
```

### iOS sound flow

```
1. content.sound: 'default' → plays system notification sound
2. No channel setup needed on iOS
```

---

## 📦 Building the APK (Android)

### Step 1 — Create an Expo account

Sign up free at **https://expo.dev**

### Step 2 — Log in

```bash
eas login
```

### Step 3 — Link to Expo

```bash
eas init
```

Say **Y** when asked to create a project.

### Step 4 — Set unique app identifiers in `app.json`

```json
"ios": {
  "bundleIdentifier": "com.yourname.notifyme"
},
"android": {
  "package": "com.yourname.notifyme"
}
```

All lowercase, no spaces, reverse-domain format.

### Step 5 — Build APK

```bash
# APK for direct install (testing / sharing)
eas build --platform android --profile preview
```

Wait 5–15 minutes. The build runs on Expo's cloud servers.

### Step 6 — Download and install

When finished, download the `.apk` from the link in your terminal or from **https://expo.dev → Projects → Builds**.

Transfer to your phone, open it, enable "Install from unknown sources" when prompted, then install.

---

## 🏪 Publishing to Google Play Store

### Requirements
- Google Developer account ($25 one-time): https://play.google.com/console

### Steps

**1. Build production AAB:**
```bash
eas build --platform android --profile production
```

**2. Create app in Play Console:**

| Section | What to fill |
|---------|-------------|
| App access | All functionality available without login |
| Ads | No ads |
| Content rating | Complete questionnaire → Everyone |
| Target audience | 18 and above |
| Data safety | No third-party sharing, encrypted in transit |
| Store listing | Name, description, screenshots (min 2) |
| App icon | 512×512 PNG |

**3. Upload AAB:** Production → Releases → Create new release → upload `.aab` → Submit

**4. Review:** 1–3 business days.

---

## 🍎 Publishing to Apple App Store

### Requirements
- Apple Developer account ($99/year): https://developer.apple.com

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

Complete the listing in **App Store Connect** (https://appstoreconnect.apple.com). Review takes 1–3 days.

---

## 🔄 Updating the App

Bump version before each rebuild:

```json
// app.json
"version": "1.0.1",
"android": {
  "versionCode": 2
}
```

Then rebuild and reinstall.

---

## 📊 App Size & Performance

| Metric | Value |
|--------|-------|
| APK size | ~45–55 MB |
| Play Store download (AAB) | ~18–25 MB |
| RAM while running | ~55–70 MB |
| RAM backgrounded | ~20–30 MB |

Size is dominated by the React Native runtime (~25 MB), not the app code.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| QR won't scan | Ensure PC and phone are on the same Wi-Fi |
| "Network response timed out" | Use your phone's hotspot for the PC |
| App crashes on load | Run `npm install` then `npx expo start --clear` |
| No notification in Expo Go | Normal for foreground — background + lock screen works |
| No sound in own APK | Settings → Apps → NotifyMe → Notifications → channel Sound |
| Duplicate notifications | Cancel-before-reschedule prevents this |
| EAS build fails | Run `eas build:configure`, verify bundle IDs in `app.json` |
| APK won't install | Enable "Install from unknown sources" in phone Settings |
| Notification fires late | Disable Battery Optimization for NotifyMe in phone Settings |
| Old data missing after update | Data is preserved under the key `@notifyme_tasks` |

---

## 🧪 Testing Guide

Run these in order. Core CRUD must pass before testing anything else — notifications, UX guards, and data all depend on basic task operations being solid.

**How to read each test:**
- **Steps** — what to do
- **Expected** — what correct behaviour looks like
- **Tags** — `[CRITICAL]` stop if this fails · `[NOTIF]` requires a physical device · `[UX]` interaction guard · `[DATA]` storage/persistence · `[REGRESSION]` guard against a known past bug

---

### Section 1 — Core CRUD

These are the most fundamental paths. Run them first on every build.

---

**TC-01 — Create a reminder** `[CRITICAL]`

Steps:
1. Tap the **+** button
2. Enter a title (e.g. "Take medication")
3. Tap **Create Reminder**

Expected:
- Card appears immediately in the list
- Toast slides in: "Reminder created"
- Stats bar Total and Active counts increment by 1
- "Next Up" banner updates if this is the soonest active task

---

**TC-02 — Edit a reminder** `[CRITICAL]`

Steps:
1. Tap an existing card to open the edit form
2. Change the title
3. Tap **Update Reminder**

Expected:
- Card title updates immediately in the list
- Toast shows "Reminder updated"
- No duplicate card appears
- Notification IDs are cancelled and rescheduled (no double-fire)

---

**TC-03 — Delete a reminder** `[CRITICAL]`

Steps:
1. Tap the trash icon on any card
2. Confirm in the dialog

Expected:
- Card disappears from the list immediately
- Toast shows "Deleted"
- Stats bar Total and Active counts decrement by 1
- If it was the last task, the empty state illustration appears

---

**TC-04 — Toggle a reminder off** `[CRITICAL]`

Steps:
1. Tap the toggle switch on an active reminder to turn it off

Expected:
- Card dims to ~58% opacity
- "PAUSED" badge appears on the card
- Toast shows "Reminder paused"
- Paused count in stats bar increments; Active count decrements
- Underlying notification is cancelled

---

**TC-05 — Toggle a reminder back on** `[CRITICAL]`

Steps:
1. Tap the toggle switch on a paused reminder to turn it on

Expected:
- Card returns to full opacity
- "PAUSED" badge disappears
- Toast shows "Reminder active"
- Active count increments; Paused count decrements
- A new notification is scheduled

---

### Section 2 — Notifications

Run these on a physical device. Notifications do not work reliably on simulators.

---

**TC-06 — One-time notification fires on time** `[CRITICAL]` `[NOTIF]`

Steps:
1. Create a one-time reminder set exactly 2 minutes from now
2. Fully close the app (swipe away from recents)
3. Lock the screen and wait

Expected:
- Notification appears at the exact scheduled time
- Notification title shows the category emoji + reminder title
- Tapping the notification opens the app and navigates to Home

---

**TC-07 — Daily notification repeats** `[NOTIF]`

Steps:
1. Create a daily reminder
2. Open Settings → check the scheduled notification count

Expected:
- Count shows 1 per time slot (e.g. 2 if two time slots were added)
- Count does not grow if you edit and re-save the same reminder

---

**TC-08 — Weekly notification fires only on selected days** `[NOTIF]`

Steps:
1. Create a weekly reminder with Monday and Wednesday selected
2. Set a time a few minutes from now on one of those days and wait

Expected:
- Notification fires only on Monday and Wednesday
- No notification fires on other days of the week

---

**TC-09 — Multiple time slots all fire** `[NOTIF]`

Steps:
1. Create a daily reminder
2. Tap "Add another time" and set a second time slot 5 minutes after the first
3. Close the app and wait for both times

Expected:
- Two separate notifications fire, one at each scheduled time
- Both use the same title and category content

---

**TC-10 — Test notification from Settings** `[NOTIF]`

Steps:
1. Go to **Settings → Send Test Notification**
2. Lock the screen immediately

Expected:
- Notification appears within 5 seconds
- Tapping it navigates back to the Home screen

---

### Section 3 — UX Guards

These tests verify that the app protects the user from accidental data loss and invalid input.

---

**TC-11 — Discard dialog on back (in-app button)** `[UX]`

Steps:
1. Tap **+** to open the Add screen
2. Type anything in the title field
3. Tap the **back arrow** (←) without saving

Expected:
- "Discard Changes?" dialog appears
- Tapping **Keep Editing** returns to the form with content intact
- Tapping **Discard** navigates back and the reminder is not saved

---

**TC-12 — Discard dialog on hardware back (Android only)** `[UX]`

Steps:
1. Tap **+** to open the Add screen
2. Type anything in the title field
3. Press the **hardware back button**

Expected:
- Same "Discard Changes?" dialog appears (hardware back is intercepted)
- Behaviour identical to TC-11

---

**TC-13 — No dialog when nothing was changed** `[UX]`

Steps:
1. Tap **+** to open the Add screen
2. Do not type anything
3. Tap the back arrow immediately

Expected:
- App navigates back directly with no dialog
- No false positive discard prompt

---

**TC-14 — No dialog after a successful save** `[UX]`

Steps:
1. Tap **+**, fill in a title, tap **Create Reminder**
2. Immediately after the toast appears, press back

Expected:
- App navigates back directly (the 900ms post-save delay does not show the discard dialog)

---

**TC-15 — Validation: past date blocked** `[UX]`

Steps:
1. Tap **+**
2. Set repeat to **One Time**
3. Pick yesterday's date or a time earlier today
4. Tap **Create Reminder**

Expected:
- Error dialog: "Past Date & Time"
- Reminder is not saved
- Form stays open so the user can correct the time

---

**TC-16 — Validation: weekly with no days selected** `[UX]`

Steps:
1. Tap **+**
2. Set repeat to **Specific Days**
3. Do not select any day
4. Tap **Create Reminder**

Expected:
- Error dialog: "Select Days"
- Reminder is not saved

---

### Section 4 — Data & Persistence

---

**TC-17 — Data survives app restart** `[DATA]`

Steps:
1. Create 3 reminders with different titles, categories, and repeat types
2. Force-close the app (swipe away from recents)
3. Reopen the app

Expected:
- All 3 reminders are present exactly as saved
- No data is lost or corrupted
- Stats bar counts are correct

---

**TC-18 — Fired reminder moves to Fired section** `[DATA]`

Steps:
1. Create a one-time reminder set 1 minute from now
2. Wait for the time to pass (or set the phone clock forward)
3. Background the app and bring it back to the foreground

Expected:
- The reminder disappears from the main list
- It appears in the collapsible "Fired Reminders" section with a "FIRED" badge and strikethrough title
- The active count in the stats bar decrements

---

**TC-19 — Search, filter, and sort work in combination** `[DATA]`

Steps:
1. Create at least 4 reminders — mix of active, paused, and different categories
2. Type a partial title in the search bar
3. While searching, change the filter to "Active"
4. Then change the sort to "Time"

Expected:
- Each control narrows or reorders the list independently
- All three (search + filter + sort) work correctly in combination
- Clearing search restores the full filtered list

---

**TC-20 — Clear all reminders** `[DATA]`

Steps:
1. Create several reminders
2. Go to **Settings → Clear All Reminders → confirm**

Expected:
- Home screen shows the empty state illustration
- Stats bar disappears
- Scheduled notification count in Settings shows 0

---

**TC-21 — Permission banner and reschedule on grant** `[DATA]` `[NOTIF]`

Steps:
1. Go to phone Settings → Apps → NotifyMe → Notifications → turn off
2. Return to the app

Expected:
- Yellow permission banner appears at the top of the Home screen
- Tapping the banner opens the phone's notification settings

Steps (continued):
3. Re-enable notifications in phone Settings
4. Return to the app

Expected:
- Banner disappears
- Any active reminders that lost their notification IDs are automatically rescheduled

---

### Section 5 — Regression Tests

These guard against bugs that were identified and fixed during development. Run them whenever touching notification scheduling, state management, or the Add/Edit screen.

---

**RT-01 — No duplicate notifications after edit** `[REGRESSION]` `[NOTIF]`

> **Background:** Editing a task without cancelling the old notification first caused two notifications to fire for the same reminder.

Steps:
1. Create a daily reminder
2. Note the scheduled count in Settings
3. Edit the reminder (change only the title) and save
4. Check the scheduled count again

Expected:
- Count stays the same before and after the edit
- The old notification IDs are cancelled before new ones are created

---

**RT-02 — Toggle does not orphan notification IDs** `[REGRESSION]` `[NOTIF]`

> **Background:** Toggling a task off and on multiple times in quick succession could leave stale notification IDs that fired alongside the new ones.

Steps:
1. Create a daily reminder
2. Toggle it off → wait 1 second → toggle it on → wait 1 second → toggle off → toggle on
3. Check scheduled count in Settings

Expected:
- Scheduled count matches the number of time slots on the reminder (e.g. 1 for a single-slot daily)
- No extra ghost notifications are scheduled

---

**RT-03 — Past one-time reminders deactivate on launch** `[REGRESSION]` `[DATA]`

> **Background:** One-time reminders whose fire time passed while the app was closed remained Active, causing the toggle and stats bar to show incorrect state.

Steps:
1. Create a one-time reminder set 1 minute from now
2. Fully close the app
3. Wait 2 minutes, then reopen the app

Expected:
- The reminder appears in the "Fired Reminders" section, not the active list
- It is marked inactive (no notification scheduled for it)
- Active count in stats bar is correct

---

**RT-04 — Edit does not reset isActive state** `[REGRESSION]`

> **Background:** Editing a paused reminder caused it to become active again, unexpectedly scheduling a notification.

Steps:
1. Create a reminder and toggle it off (paused state)
2. Tap the card to edit it
3. Change the description and tap **Update Reminder**

Expected:
- Reminder remains paused after saving
- No notification is scheduled
- "PAUSED" badge is still visible on the card

---

**RT-05 — Android channel only created once** `[REGRESSION]` `[NOTIF]`

> **Background:** Re-creating the Android notification channel on every launch reset the user's custom sound/volume preferences set in phone Settings.

Steps:
1. On Android, install the app and grant permissions
2. Go to phone Settings → Apps → NotifyMe → Notifications → set a custom sound
3. Force-close and reopen the app
4. Check phone Settings again

Expected:
- The custom sound setting is preserved across app restarts
- The channel is not recreated (idempotent setup, controlled by `CHANNEL_INIT_KEY` in AsyncStorage)

---

**RT-06 — Discard guard does not fire after successful save** `[REGRESSION]` `[UX]`

> **Background:** After a successful save, `saving` was reset to `false` in the `finally` block before the 900ms navigation delay. During that window, pressing back showed the discard dialog even though the task was already saved.

Steps:
1. Create a new reminder and tap **Create Reminder**
2. Immediately (within 1 second) press the hardware back button or in-app back arrow

Expected:
- App navigates back directly
- No "Discard Changes?" dialog appears after a successful save

---

**RT-07 — Stats bar does not double-count** `[REGRESSION]`

> **Background:** `StatsBar` was receiving the raw `tasks` array and re-filtering it internally, while `HomeScreen` had already computed `activeCount` and `pausedCount`. This meant the counts were computed twice and could theoretically drift if the prop update timing was off.

Steps:
1. Create 5 reminders
2. Pause 2 of them
3. Check the stats bar values

Expected:
- Total: 5, Active: 3, Paused: 2 — exactly matching the actual task states
- Values update immediately on every toggle with no delay or mismatch

---

**RT-08 — Search + filter combination shows correct empty state** `[REGRESSION]`

> **Background:** When a search query returned no results under an active filter, the wrong empty state message was shown (e.g. "No Paused Reminders" instead of "No results for 'xyz'").

Steps:
1. Set the filter to "Active"
2. Type a search term that matches nothing

Expected:
- Empty state shows "No results" for the search query (not the filter's empty state)
- Clearing the search restores the filter's view correctly

---

## 💡 Future Enhancement Ideas

| Feature | Description |
|---------|-------------|
| Snooze | Tap notification → snooze 10 / 30 minutes |
| Repeat by interval | Every X hours or X days |
| Reminder history log | Full log of all fired reminders |
| Export / backup | Share reminders as JSON |
| Location reminders | Fire when arriving at a place |
| Home screen widget | Show next reminder without opening the app |
| Wear OS / Apple Watch | Notification mirror on wearables |

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo` | Core Expo SDK |
| `expo-notifications` | Scheduled push notifications |
| `expo-device` | Detect physical device vs simulator |
| `expo-haptics` | Haptic feedback |
| `expo-linear-gradient` | Gradient UI elements |
| `@react-native-async-storage/async-storage` | Local persistent storage |
| `@react-navigation/native` | Navigation container |
| `@react-navigation/stack` | Stack + modal navigation |
| `react-native-gesture-handler` | Touch gesture support |
| `react-native-safe-area-context` | Safe area insets |
| `@expo/vector-icons` | Ionicons icon set |

---

*NotifyMe — Built with Expo + React Native*
