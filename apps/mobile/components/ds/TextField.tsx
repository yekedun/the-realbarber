import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  KeyboardTypeOptions,
} from 'react-native';
import { colors, radius } from '../../lib/theme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  style?: ViewStyle;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  editable = true,
  style,
}: TextFieldProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.slate[300]}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },

  label: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    /* source: letterSpacing 0.16em; theme token overline = 2.5 (design intent) */
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
    lineHeight: 11,
  },

  input: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    lineHeight: 21, /* 15 * 1.4 */
    color: colors.ink[900],
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
