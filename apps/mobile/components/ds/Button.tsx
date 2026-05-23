import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius } from '../../lib/theme';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  onPress?: () => void;
  full?: boolean;
  disabled?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  full = false,
  disabled = false,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.8}
      style={[
        styles.base,
        styles[`size_${size}` as keyof typeof styles] as ViewStyle,
        styles[`variant_${variant}` as keyof typeof styles] as ViewStyle,
        full && styles.full,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.inner}>
        {typeof children === 'string' ? (
          <Text
            style={[
              styles.label,
              styles[`label_${size}` as keyof typeof styles] as object,
              styles[`labelColor_${variant}` as keyof typeof styles] as object,
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  full: {
    alignSelf: 'stretch',
  },

  disabled: {
    opacity: 0.45,
  },

  // Sizes
  size_sm: {
    height: 34,
    paddingHorizontal: 12,
  },
  size_md: {
    height: 44,
    paddingHorizontal: 18,
  },
  size_lg: {
    height: 52,
    paddingHorizontal: 20,
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.ink[900],
    borderColor: 'transparent',
  },
  variant_accent: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[700],
  },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderColor: colors.ink[900],
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  variant_danger: {
    backgroundColor: 'transparent',
    borderColor: colors.coral[600],
  },

  // Label shared
  label: {
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: -0.07,
  },

  // Label sizes
  label_sm: { fontSize: 13 },
  label_md: { fontSize: 14 },
  label_lg: { fontSize: 15 },

  // Label colors
  labelColor_primary:   { color: '#ffffff' },
  labelColor_accent:    { color: '#ffffff' },
  labelColor_secondary: { color: colors.ink[900] },
  labelColor_ghost:     { color: colors.ink[900] },
  labelColor_danger:    { color: colors.coral[600] },
});
