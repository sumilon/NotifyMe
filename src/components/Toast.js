import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';

const CONFIGS = {
  success: { bg: COLORS.success + '18', border: COLORS.success, icon: 'checkmark-circle', iconColor: COLORS.success  },
  error:   { bg: COLORS.error   + '18', border: COLORS.error,   icon: 'close-circle',     iconColor: COLORS.error    },
  warning: { bg: COLORS.warning + '18', border: COLORS.warning, icon: 'warning',           iconColor: COLORS.warning  },
  info:    { bg: COLORS.info    + '18', border: COLORS.info,    icon: 'information-circle', iconColor: COLORS.info    },
};

export default function Toast({ toast }) {
  const ty = useRef(new Animated.Value(-110)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    ty.setValue(-110);
    op.setValue(0);
    Animated.parallel([
      Animated.spring(ty, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ty, { toValue: -110, duration: 300, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0,    duration: 300, useNativeDriver: true }),
      ]).start();
    }, 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const cfg = CONFIGS[toast.type] || CONFIGS.info;

  return (
    <Animated.View style={[
      s.wrap,
      { borderColor: cfg.border + '40', transform: [{ translateY: ty }], opacity: op },
    ]}>
      <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{toast.title}</Text>
        {!!toast.message && <Text style={s.msg} numberOfLines={1}>{toast.message}</Text>}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 48,
    left: SPACING.lg, right: SPACING.lg,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    backgroundColor: '#18181B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 18,
  },
  title: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, letterSpacing: -0.1 },
  msg:   { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 1 },
});
