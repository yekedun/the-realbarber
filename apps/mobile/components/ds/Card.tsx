import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
  accent?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  padding = 16,
  accent = false,
}: CardProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    accent ? styles.accentBg : styles.defaultBg,
    accent ? styles.accentBorder : styles.defaultBorder,
    { padding },
    style ?? {},
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[containerStyle, styles.shadow]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[containerStyle, styles.shadow]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
  },

  defaultBg: {
    backgroundColor: colors.slate[0],
  },
  accentBg: {
    backgroundColor: colors.brand[600],
  },

  defaultBorder: {
    borderColor: colors.slate[200],
  },
  accentBorder: {
    borderColor: colors.brand[700],
  },

  shadow: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
});
