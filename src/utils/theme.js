// ─── NotifyMe Design System v2 ─────────────────────────────────────────────────
export const COLORS = {
  background:      '#000000',
  surface:         '#111113',
  surfaceElevated: '#1C1C1E',
  surfaceHigh:     '#2C2C2E',
  surfaceMid:      '#242426',
  surfaceGlass:    'rgba(17,17,19,0.88)',

  primary:         '#0A84FF',
  primaryLight:    '#5AC8FA',
  primaryDark:     '#0055CC',
  primaryMuted:    'rgba(10,132,255,0.14)',
  primaryGlow:     'rgba(10,132,255,0.28)',

  success:         '#30D158',
  successMuted:    'rgba(48,209,88,0.14)',
  warning:         '#FF9F0A',
  warningMuted:    'rgba(255,159,10,0.14)',
  error:           '#FF453A',
  errorMuted:      'rgba(255,69,58,0.14)',
  info:            '#64D2FF',
  infoMuted:       'rgba(100,210,255,0.14)',
  purple:          '#BF5AF2',
  purpleMuted:     'rgba(191,90,242,0.14)',

  textPrimary:     '#FFFFFF',
  textSecondary:   'rgba(235,235,245,0.78)',
  textTertiary:    'rgba(235,235,245,0.48)',
  textMuted:       'rgba(235,235,245,0.28)',
  textOnPrimary:   '#FFFFFF',

  border:          'rgba(255,255,255,0.08)',
  borderMid:       'rgba(255,255,255,0.11)',
  borderStrong:    'rgba(255,255,255,0.16)',

  catGeneral:  '#0A84FF',
  catWork:     '#5E5CE6',
  catHealth:   '#FF375F',
  catFitness:  '#30D158',
  catPersonal: '#FF9F0A',
  catFinance:  '#64D2FF',
  catStudy:    '#BF5AF2',
  catSocial:   '#FF6961',

  gradientPrimary: ['#0A84FF', '#0055D4'],
  gradientSuccess: ['#30D158', '#1DA845'],
  gradientError:   ['#FF453A', '#CC2F26'],
  gradientSurface: ['#1C1C1E', '#111113'],
  gradientDark:    ['#0A0A0C', '#000000'],
  gradientPurple:  ['#BF5AF2', '#9B3DD0'],
};

export const FONTS = {
  sizes: {
    xxs: 10, xs: 12, sm: 13, md: 15, lg: 17,
    xl: 20, xxl: 24, xxxl: 30, display: 36,
  },
  weights: {
    regular: '400', medium: '500', semibold: '600',
    bold: '700', extrabold: '800', black: '900',
  },
};

export const SPACING = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16,
  xl: 20, xxl: 24, xxxl: 32, section: 48,
};

export const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, xxl: 26, xxxl: 34, full: 999,
};

export const SHADOWS = {
  sm:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 4,  elevation: 3  },
  md:     { shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.32, shadowRadius: 10, elevation: 7  },
  lg:     { shadowColor: '#000', shadowOffset: { width: 0, height: 10}, shadowOpacity: 0.42, shadowRadius: 20, elevation: 14 },
  blue:   { shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 14, elevation: 10 },
  blueSm: { shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8,  elevation: 6  },
};

export const REPEAT_TYPES = { ONCE: 'once', DAILY: 'daily', WEEKLY: 'weekly' };

export const DAYS_OF_WEEK = [
  { id: 0, label: 'S', full: 'Sunday'    },
  { id: 1, label: 'M', full: 'Monday'    },
  { id: 2, label: 'T', full: 'Tuesday'   },
  { id: 3, label: 'W', full: 'Wednesday' },
  { id: 4, label: 'T', full: 'Thursday'  },
  { id: 5, label: 'F', full: 'Friday'    },
  { id: 6, label: 'S', full: 'Saturday'  },
];

// ─── SINGLE SOURCE OF TRUTH for categories ─────────────────────────────────────
// Used by: AddTaskScreen, TaskCard, notificationService, SettingsScreen
export const CATEGORIES = [
  { id: 'general',  label: 'General',  icon: 'grid',               color: '#0A84FF' },
  { id: 'work',     label: 'Work',     icon: 'briefcase',           color: '#5E5CE6' },
  { id: 'health',   label: 'Health',   icon: 'fitness',             color: '#FF375F' },
  { id: 'fitness',  label: 'Fitness',  icon: 'barbell',             color: '#30D158' },
  { id: 'personal', label: 'Personal', icon: 'sparkles',            color: '#FF9F0A' },
  { id: 'finance',  label: 'Finance',  icon: 'wallet',              color: '#64D2FF' },
  { id: 'study',    label: 'Study',    icon: 'school',              color: '#BF5AF2' },
  { id: 'social',   label: 'Social',   icon: 'chatbubble-ellipses', color: '#FF6961' },
];

/** Look up a category by id. Falls back to 'general'. */
export function getCategoryMeta(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}

/**
 * Format a 12-hour time display from local integers stored on a task.
 * Always use task.timeHour / task.timeMinute — NEVER parse task.time ISO string,
 * which is UTC and will show the wrong hour in non-UTC timezones.
 */
export function formatTaskTime(task) {
  const h = task.timeHour ?? new Date(task.time).getHours();
  const m = task.timeMinute ?? new Date(task.time).getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const h12   = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Generate a cryptographically random unique ID.
 * Uses crypto.randomUUID() when available (React Native 0.73+), otherwise
 * falls back to a timestamp + random suffix — no deprecated substr().
 */
export function generateId(prefix = 'id') {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {}
  // Fallback: timestamp + random hex
  const rand = Math.random().toString(36).slice(2, 11);
  return `${prefix}_${Date.now()}_${rand}`;
}
