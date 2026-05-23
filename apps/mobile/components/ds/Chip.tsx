import React from 'react';
import {
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, radius } from '../../lib/theme';

/* ── Chip ───────────────────────────────────────────────────── */

interface ChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ children, selected = false, onPress, style }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipDefault, style]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

/* ── ChipRow ────────────────────────────────────────────────── */

interface ChipRowProps {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
}

export function ChipRow({ children, padded = true, style }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.rowContent, !padded && styles.rowNoPad, style]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* Chip */
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipDefault:  { borderColor: colors.slate[200], backgroundColor: colors.slate[0] },
  chipSelected: { borderColor: colors.ink[900],   backgroundColor: colors.ink[900] },

  label: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
    lineHeight: 13,
  },
  labelSelected: { color: '#ffffff' },

  /* ChipRow */
  rowContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  rowNoPad: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
