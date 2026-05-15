import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../utils/theme";

export default function SheetModal({ visible, onClose, title, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={s.overlay} />
        </TouchableWithoutFeedback>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={s.doneBtn}>
              <Text style={s.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopLeftRadius: RADIUS.xxxl,
    borderTopRightRadius: RADIUS.xxxl,
    paddingBottom: 48,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: "center",
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  doneTxt: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: "#fff",
  },
});
