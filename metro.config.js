// metro.config.js
// Required for Expo SDK 54 on Android / Expo Go.
// This bootstraps Metro with expo's asset resolver so native modules
// (ExpoAsset, etc.) are found correctly at runtime.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
