import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../utils/theme";

const ITEM_HEIGHT = 48;
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS = ["AM", "PM"];

/**
 * PickerCol — defined OUTSIDE TimePicker so it never remounts on parent re-render.
 * Remounting was causing the ScrollView to reset to position 0.
 * Uses forwardRef so parent can scroll to initial selection on open.
 */
const PickerCol = React.forwardRef(function PickerCol(
  { data, selected, onSelect, label, fmt },
  ref,
) {
  return (
    <View style={s.col}>
      <Text style={s.colLabel}>{label}</Text>
      <ScrollView
        ref={ref}
        style={s.colScroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        snapToAlignment="center"
      >
        {data.map((item, idx) => {
          const active = item === selected;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => {
                onSelect(item);
                ref?.current?.scrollTo({
                  y: idx * ITEM_HEIGHT,
                  animated: true,
                });
              }}
              style={[s.colItem, active && s.colItemActive]}
            >
              <Text style={[s.colItemTxt, active && s.colItemTxtActive]}>
                {fmt ? fmt(item) : String(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default function TimePicker({ hour, minute, onChange }) {
  const curPer = hour >= 12 ? "PM" : "AM";
  const curH12 = hour % 12 || 12;

  const hourRef = useRef(null);
  const minRef = useRef(null);

  // On first mount: scroll both columns so current selection is visible
  useEffect(() => {
    const hIdx = HOURS_12.indexOf(curH12);
    const mIdx = minute;
    const timer = setTimeout(() => {
      hourRef.current?.scrollTo({ y: hIdx * ITEM_HEIGHT, animated: false });
      minRef.current?.scrollTo({ y: mIdx * ITEM_HEIGHT, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (h12, min, period) => {
    let h = h12 % 12;
    if (period === "PM") h += 12;
    onChange(h, min);
  };

  return (
    <View style={s.timeRow}>
      <PickerCol
        ref={hourRef}
        data={HOURS_12}
        selected={curH12}
        label="Hour"
        fmt={(h) => String(h).padStart(2, "0")}
        onSelect={(h) => update(h, minute, curPer)}
      />
      <Text style={s.sep}>:</Text>
      <PickerCol
        ref={minRef}
        data={MINUTES}
        selected={minute}
        label="Min"
        fmt={(m) => String(m).padStart(2, "0")}
        onSelect={(m) => update(curH12, m, curPer)}
      />
      <View style={s.col}>
        <Text style={s.colLabel}>Period</Text>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => update(curH12, minute, p)}
            style={[s.colItem, curPer === p && s.colItemActive]}
          >
            <Text style={[s.colItemTxt, curPer === p && s.colItemTxtActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sep: {
    fontSize: 26,
    color: COLORS.textPrimary,
    alignSelf: "center",
    marginTop: 24,
    fontWeight: "200",
  },
  col: { flex: 1 },
  colLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  colScroll: { maxHeight: 240 },
  colItem: {
    height: ITEM_HEIGHT,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  colItemActive: { backgroundColor: COLORS.primary },
  colItemTxt: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  colItemTxtActive: { color: "#fff", fontWeight: FONTS.weights.bold },
});
