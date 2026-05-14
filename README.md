# 🔔 NotifyMe — Smart Reminder App

A professional, lightweight task reminder app built with **Expo 50 + React Native 0.73**.
Set reminders by category, get push notifications with sound — even when the app is closed.

---

## 📁 Project Structure

```
notifyme/
├── App.js                              ← Root: navigation + notification listeners
├── app.json                            ← Expo config: name, icons, permissions, sound
├── package.json                        ← Dependencies
├── babel.config.js                     ← Babel transpiler config
├── metro.config.js                     ← Metro bundler config
├── eas.json                            ← EAS build profiles (APK / AAB)
├── assets/
│   ├── icon.png                        ← App icon 1024×1024 (home screen)
│   ├── adaptive-icon.png               ← Android adaptive icon 1024×1024
│   ├── splash.png                      ← Splash/loading screen 1284×2778
│   ├── favicon.png                     ← Browser tab icon 64×64
│   ├── notification-icon.png           ← Android notification bar icon 96×96
│   └── sounds/
│       └── notification.wav            ← Custom notification sound (bundled in APK)
└── src/
    ├── components/
    │   ├── TaskCard.js                 ← Reminder card, EmptyState, StatsBar
    │   ├── ConfirmDialog.js            ← In-app themed confirm/alert dialog
    │   ├── Toast.js                    ← Slide-in feedback toast
    │   └── Icon.js                     ← SVG icon library
    ├── context/
    │   └── TaskContext.js              ← Global state: tasks, CRUD, permissions
    ├── screens/
    │   ├── HomeScreen.js               ← Main list, search, filters
    │   ├── AddTaskScreen.js            ← Create / edit reminder form
    │   └── SettingsScreen.js           ← Settings, test notification, debug tools
    └── utils/
        ├── notificationService.js      ← All notification logic + channel setup
        ├── storage.js                  ← AsyncStorage read/write
        └── theme.js                    ← Colors, fonts, spacing, categories
```

---

## ✨ Features

- Create reminders with title, description, category, time
- One-time, Daily, or Weekly (specific days) repeat
- 8 categories: General, Work, Health, Fitness, Personal, Finance, Study, Social
- Push notifications that fire even when app is closed
- Meaningful notification body by category when no description given
- Search and filter reminders (All / Active / Paused)
- Toggle reminders on/off without deleting
- In-app Toast feedback — no system Alert popups
- In-app ConfirmDialog for delete actions
- Stats bar: Total / Active / Today's count
- Settings with notification test button and debug tools
- Works on Android, iOS, and Web browser

---

## 🛠 Prerequisites

```cmd
# Node.js v18+
node --version

# Expo CLI
npm install -g expo-cli

# EAS CLI (for building APK)
npm install -g eas-cli
```

Also install **Expo Go** on your phone:
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent
- iOS: https://apps.apple.com/app/expo-go/id982107779

---

## 🚀 Running Locally

### Step 1 — Install dependencies

```cmd
cd notifyme
npm install
```

### Step 2 — Start the dev server

```cmd
# For mobile testing via Expo Go
npx expo start

# For web browser only
npx expo start --web

# Clear cache if something looks wrong
npx expo start --clear
```

### Step 3 — Open on your phone

**Android:** Open Expo Go → tap "Scan QR Code" → scan the QR in your terminal

**iOS:** Open the default Camera app → scan the QR → tap the banner → opens in Expo Go

> Both your phone and PC must be on the same Wi-Fi network.
> If on office Wi-Fi (blocks device-to-device traffic), share your phone's hotspot and connect your PC to it.

### Step 4 — Allow notifications

When the app opens, tap **Allow** when prompted for notification permission.

### Step 5 — Test notifications

Go to **Settings tab → Send Test Notification** → tap it → lock your screen → notification fires in 5 seconds.

---

## 🔊 About Notification Sound

### Why sound may not work in Expo Go

**Expo Go is a pre-built app owned by Expo Inc.** It cannot access custom sound files bundled in your project because those files are only compiled into **your own APK** during `eas build`.

| Environment | Notification | Sound |
|------------|-------------|-------|
| Expo Go    | ✅ Works     | ⚠️ System default only |
| Your APK   | ✅ Works     | ✅ Custom wav file |

**This is a platform limitation — not a code bug.**

The app detects whether it's running in Expo Go automatically and uses the correct sound:
- **Expo Go:** `sound: 'default'` (system sound — may still be heard)
- **Own APK:** `sound: 'notification.wav'` (custom bundled chime)

### How Android notification sound works

```
Android sound flow:
  1. Channel is created with sound: 'notification' (filename without .wav)
  2. The .wav file is compiled into: android/app/src/main/res/raw/notification.wav
  3. Every scheduled notification trigger includes channelId: 'notifyme_channel_v2'
  4. Android routes the notification through that channel → plays the sound

What breaks sound:
  ✗ Missing channelId in trigger → routes through silent default channel
  ✗ content.sound on Android → Android ignores it (iOS only)
  ✗ Stale cached channel → old channel has no sound, new code is ignored
  ✓ Our fix: delete all old channels + recreate with correct sound every launch
```

### How iOS notification sound works

```
iOS sound flow:
  1. content.sound: 'notification.wav' → iOS reads the file from app bundle
  2. Notification fires → plays custom sound
  No channel setup needed on iOS.
```

---

## 📦 Building the APK (Install on Android)

### Step 1 — Create Expo account

Sign up free at **https://expo.dev**

### Step 2 — Login

```cmd
eas login
```

### Step 3 — Link project to Expo

```cmd
eas init
```
Say **Y** when asked to create a project. This adds your `projectId` to `app.json`.

### Step 4 — Set unique app identifiers in app.json

```json
"ios": {
  "bundleIdentifier": "com.yourname.notifyme"
},
"android": {
  "package": "com.yourname.notifyme"
}
```

Rules: all lowercase, no spaces, reverse domain format.

### Step 5 — Configure EAS

```cmd
eas build:configure
```

Select **Android** when asked. This creates / updates `eas.json`.

### Step 6 — Build APK

```cmd
# APK for direct install (testing / sharing)
eas build --platform android --profile preview
```

Wait 5–15 minutes. Build runs on Expo's cloud servers.

### Step 7 — Download APK

When build finishes:
```
✔ Build finished
Download: https://expo.dev/.../download  ← open in browser, click Download
```

Or go to **https://expo.dev → Projects → notifyme → Builds → Download**.

### Step 8 — Install on phone

Transfer APK to phone (WhatsApp, email, USB, Google Drive), then:
1. Open the `.apk` file
2. Tap **Settings** when Android warns "unknown sources"
3. Enable **"Allow from this source"**
4. Press back → tap **Install** → **Open**

### Step 9 — Verify sound

After installing:
```
Settings → Apps → NotifyMe → Notifications
→ NotifyMe Reminders channel → Sound → should show "notification" or similar
```

If Sound shows "None", tap it and pick any sound. Then go to **Settings tab → Send Test Notification**.

---

## 🏪 Publishing to Google Play Store

### Requirements
- Google Developer account ($25 one-time): https://play.google.com/console

### Steps

**1. Build production AAB:**
```cmd
eas build --platform android --profile production
```

**2. Create app in Play Console:**
- Go to https://play.google.com/console
- **Create app** → fill name, language, type, pricing
- Complete the checklist:

| Section | What to fill |
|---------|-------------|
| App access | All functionality available |
| Ads | No ads |
| Content rating | Complete questionnaire → Everyone |
| Target audience | 18 and above |
| Data safety | No third-party sharing, encrypted in transit |
| Store listing | Name, description, screenshots (min 2) |
| App icon | 512×512 PNG |

**3. Upload AAB:**
- Production → Releases → Create new release
- Upload `.aab` file from EAS
- Add release notes → Review → Start rollout

**4. Wait for review:** 1–3 business days. Email notification when approved.

---

## 🍎 Publishing to Apple App Store

### Requirements
- Apple Developer account ($99/year): https://developer.apple.com
- Mac computer (required for iOS builds)

### Steps

```cmd
# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

Complete the listing in **App Store Connect** (https://appstoreconnect.apple.com).
Apple review takes 1–3 days.

---

## 🔄 Updating the App

Bump version before each rebuild:

```json
// app.json
"version": "1.0.1",
"android": {
  "versionCode": 3
}
```

Then rebuild:
```cmd
eas build --platform android --profile preview
```

Uninstall old APK from phone → install new APK.

---

## 📊 App Size & Performance

| Metric | Value |
|--------|-------|
| APK size | ~45–55 MB |
| Play Store download (AAB) | ~18–25 MB |
| RAM while running | ~55–70 MB |
| RAM backgrounded | ~20–30 MB |

Size is dominated by React Native runtime (~25 MB), not your code (~100 KB).

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| QR won't scan | PC and phone on same Wi-Fi |
| "Network response timed out" | Use phone hotspot for PC |
| App crashes on load | `npm install` then `npx expo start --clear` |
| No notification in Expo Go | Normal for foreground — background + lock screen should work |
| No sound in Expo Go | Expected — build your own APK for custom sound |
| No sound in own APK | Check Settings → Apps → NotifyMe → Notifications → channel Sound |
| Duplicate notifications | Fixed — cancel-before-reschedule prevents this |
| EAS build fails | Run `eas build:configure`, check bundle IDs in app.json |
| APK won't install | Enable "Install from unknown sources" in phone Settings |
| Old data missing after update | Data preserved under key `@notifyme_tasks` |
| Notification fires late | Disable Battery Optimization for NotifyMe |

---

## 🧪 Pre-Release Testing Checklist

- [ ] Add a reminder → appears in list
- [ ] Edit a reminder → saved, no duplicate notification
- [ ] Delete a reminder → removed, notification cancelled
- [ ] Toggle off → reminder paused, notification cancelled
- [ ] Toggle on → reminder resumes, notification scheduled
- [ ] Set reminder 3 min from now → close app → notification fires on time
- [ ] Notification sound plays (own APK only)
- [ ] Weekly reminder → fires only on selected days
- [ ] Search works correctly
- [ ] Filter (All / Active / Paused) works correctly
- [ ] Settings → Send Test Notification → fires in 5 seconds
- [ ] Settings → Check Scheduled Count → shows correct number
- [ ] Data persists after closing and reopening app

---

## 💡 Future Enhancement Ideas

| Feature | Description |
|---------|-------------|
| Snooze | Tap notification → snooze 10 / 30 minutes |
| Recurring by interval | Every X hours / X days |
| Reminder history | Log of all fired reminders |
| Multiple profiles | Switch between family members |
| Export / backup | Share reminders as JSON or PDF |
| Dark / light theme toggle | User preference |
| Location reminders | Fire when arriving at a place |
| Attachment | Photo or document per reminder |
| Widgets | Home screen widget showing next reminder |
| Watch support | Wear OS / Apple Watch notification |

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~50.0.14 | Core Expo SDK |
| `expo-notifications` | ~0.27.0 | Push & scheduled notifications |
| `expo-device` | ~5.9.4 | Detect physical device |
| `expo-constants` | ~15.4.6 | Detect Expo Go vs standalone |
| `expo-linear-gradient` | ~12.7.2 | Gradient UI elements |
| `@react-native-async-storage/async-storage` | 1.21.0 | Local storage |
| `@react-navigation/native` | ^6.1.17 | Navigation container |
| `@react-navigation/stack` | ^6.3.29 | Stack (modal) navigation |
| `@react-navigation/bottom-tabs` | ^6.5.20 | Tab bar navigation |
| `react-native-svg` | 14.1.0 | SVG icon library |
| `date-fns` | ^3.6.0 | Date formatting |
| `react-native-gesture-handler` | ~2.14.0 | Touch gestures |
| `react-native-safe-area-context` | 4.8.2 | Safe area handling |

---

*NotifyMe v1.0 — Built with Expo 50 + React Native 0.73*