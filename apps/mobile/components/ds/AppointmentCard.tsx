import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../lib/theme';

type AppointmentState = 'upcoming' | 'active' | 'done';

interface AppointmentCardProps {
  time: string;
  duration: number | string;
  name: string;
  service: string;
  state?: AppointmentState;
  onPress?: () => void;
  style?: ViewStyle;
}

export function AppointmentCard({
  time,
  duration,
  name,
  service,
  state = 'upcoming',
  onPress,
  style,
}: AppointmentCardProps) {
  const isActive = state === 'active';
  const isDone   = state === 'done';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[
        styles.base,
        isActive ? styles.bgActive : styles.bgDefault,
        isDone && styles.opacityDone,
        style,
      ]}
    >
      {/* Left: time + duration */}
      <View style={styles.timeCol}>
        <Text style={[styles.time, isActive && styles.textWhite]}>
          {time}
        </Text>
        <Text style={[styles.dur, isActive ? styles.durActive : styles.durDefault]}>
          {duration} DK
        </Text>
      </View>

      {/* Right: name + service */}
      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            isActive && styles.textWhite,
            isDone && styles.strikethrough,
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.service,
            isActive ? styles.serviceActive : styles.serviceDefault,
          ]}
          numberOfLines={1}
        >
          {service}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    ...shadows.xs,
  },

  /* State: backgrounds + borders */
  bgDefault: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  bgActive: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[700],
  },
  opacityDone: { opacity: 0.55 },

  /* Time column — fixed 56 wide */
  timeCol: { width: 56 },

  time: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
    lineHeight: 14,
  },
  dur: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  durDefault: { color: colors.slate[500] },
  durActive:  { color: 'rgba(255,255,255,0.6)' },

  /* Info column */
  info: { flex: 1, minWidth: 0 },

  name: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
    lineHeight: 18,
  },
  service: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  serviceDefault: { color: colors.slate[500] },
  serviceActive:  { color: 'rgba(255,255,255,0.6)' },

  /* Shared overrides */
  textWhite:    { color: '#ffffff' },
  strikethrough: { textDecorationLine: 'line-through' },
});
