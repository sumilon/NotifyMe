import React, { useMemo } from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../utils/theme";

export default function DatePicker({ dateYear, dateMonth, dateDay, onChange }) {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 60 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  return (
    <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
      {days.map((d, i) => {
        const selected =
          d.getFullYear() === dateYear &&
          d.getMonth() === dateMonth &&
          d.getDate() === dateDay;
        const label =
          i === 0
            ? "Today"
            : i === 1
              ? "Tomorrow"
              : d.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
        return (
          <TouchableOpacity
            key={i}
            style={[s.dateItem, selected && s.dateItemActive]}
            onPress={() => onChange(d.getFullYear(), d.getMonth(), d.getDate())}
          >
            <Text style={[s.dateItemTxt, selected && s.dateItemTxtActive]}>
              {label}
            </Text>
            {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  dateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginBottom: 2,
  },
  dateItemActive: { backgroundColor: COLORS.primary },
  dateItemTxt: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  dateItemTxtActive: { color: "#fff", fontWeight: FONTS.weights.bold },
});
