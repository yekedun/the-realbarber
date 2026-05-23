import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../lib/theme';
import { StatusPill } from './StatusPill';

interface StaffRowProps {
  name: string;
  meta?: string;
  /** 'Aktif' renders an ok (mint) pill; anything else renders a bad (coral) pill. */
  status?: 'Aktif' | 'Pasif';
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function StaffRow({
  name,
  meta,
  status,
  trailing,
  onPress,
  style,
}: StaffRowProps) {
  /**
   * Initials: first letter of each word, max 2, uppercased.
   * Source: name.split(' ').map(n => n[0]).join('').slice(0, 2)
   */
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const Container = (onPress ? TouchableOpacity : View) as React.ComponentType<any>;
  const containerProps = onPress
    ? { onPress, activeOpacity: 0.8 as number }
    : {};

  return (
    <Container {...containerProps} style={[styles.row, style]}>
      {/* Avatar circle with initials */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Name + meta */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {meta != null && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      {/* Optional status pill */}
      {status != null && (
        <StatusPill tone={status === 'Aktif' ? 'ok' : 'bad'}>
          {status}
        </StatusPill>
      )}

      {/* Optional trailing slot (icon, chevron, etc.) */}
      {trailing}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.slate[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },

  /* 36×36 circle, slate-100 bg, ink-900 initials */
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
    letterSpacing: 0.4,
  },

  /* Name + meta stack */
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  meta: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    /* source: var(--fg-3) = semantic.fg3 = colors.slate[500] */
    color: colors.slate[500],
    marginTop: 2,
  },
});
