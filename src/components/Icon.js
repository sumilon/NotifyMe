/**
 * Pure emoji/text icon component — zero native font dependencies.
 * Works identically on Expo Go (iOS + Android) and web.
 */
import React from 'react';
import { Text } from 'react-native';

const ICONS = {
  // Navigation
  'notifications':          '🔔',
  'notifications-outline':  '🔔',
  'settings':               '⚙️',
  'settings-outline':       '⚙️',
  // Actions
  'add':                    '＋',
  'arrow-back':             '←',
  'chevron-forward':        '›',
  'close-circle':           '✕',
  'trash-outline':          '🗑',
  'pencil-outline':         '✏️',
  // Status / info
  'checkmark-circle-outline': '✅',
  'warning-outline':          '⚠️',
  'information-circle-outline':'ℹ️',
  // Time / date
  'time-outline':           '🕐',
  'calendar-outline':       '📅',
  'calendar-number-outline':'📆',
  'today-outline':          '📅',
  'repeat-outline':         '🔁',
  // Stats
  'list-outline':           '📋',
  'stats-chart-outline':    '📊',
  // Misc
  'search-outline':         '🔍',
  'phone-portrait-outline': '📱',
  'code-slash-outline':     '💻',
};

export default function Icon({ name, size = 18, color, style }) {
  const emoji = ICONS[name] || '•';
  return (
    <Text
      style={[
        {
          fontSize: size * 0.85,
          color: color || '#fff',
          includeFontPadding: false,
          textAlignVertical: 'center',
          lineHeight: size * 1.2,
        },
        style,
      ]}
    >
      {emoji}
    </Text>
  );
}
