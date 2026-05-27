import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors } from '../../lib/theme';

interface SectionLabelProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <Text style={[styles.label, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,   // 0.16em at 11px
    textTransform: 'uppercase',
    color: colors.slate[400],
    // padding: '0 20px' in HTML → horizontal padding only
    paddingHorizontal: 20,
    // margin: '24px 0 10px' → top 24, bottom 10, no horizontal margin
    marginTop: 24,
    marginBottom: 10,
    lineHeight: 11,
  },
});
