import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../lib/theme';

interface BlokCardProps {
  time: string;
  endTime: string;
  duration: number | string;
  label?: string;
  style?: ViewStyle;
}

/**
 * BlokCard — blocked-off time slot.
 *
 * The source uses a CSS repeating-linear-gradient diagonal stripe pattern.
 * React Native's StyleSheet does not support gradient backgrounds natively.
 * We faithfully reproduce the intent with a sunken-surface tint (slate[100])
 * + dashed border (slate[400]), matching all other numeric values exactly.
 * Callers who need the stripe can swap `backgroundColor` via the `style` prop
 * with a gradient library (e.g. expo-linear-gradient with repeating tiles).
 */
export function BlokCard({ time, endTime, duration, label = 'BLOKE', style }: BlokCardProps) {
  return (
    <View style={[styles.base, style]}>
      {/* Left: time + duration */}
      <View style={styles.timeCol}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.dur}>{endTime}</Text>
      </View>

      {/* Right: block label, centred vertically */}
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.slate[400],
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    /* Approximates the diagonal stripe pattern from the source */
    backgroundColor: colors.slate[100],
  },

  /* Time column — fixed 56 wide, mirrors AppointmentCard */
  timeCol: { width: 56 },

  time: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: colors.slate[700],
  },
  dur: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[500],
    marginTop: 5,
  },

  /* Label column */
  labelWrap: { flex: 1, justifyContent: 'center' },
  label: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    /* source: var(--fg-2) = semantic.fg2 = colors.slate[700] */
    color: colors.slate[700],
  },
});
