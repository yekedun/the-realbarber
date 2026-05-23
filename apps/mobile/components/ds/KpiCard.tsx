import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { Card } from './Card';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  accent?: boolean;
}

export function KpiCard({ label, value, unit, sub, accent = false }: KpiCardProps) {
  return (
    <Card padding={14} accent={accent} style={styles.cardBase}>
      {/* Overline label */}
      <Text style={[styles.label, accent ? styles.labelAccent : styles.labelDefault]}>
        {label}
      </Text>

      {/* Value row */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, accent ? styles.valueAccent : styles.valueDefault]}>
          {value}
        </Text>
        {unit != null && (
          <Text style={[styles.unit, accent ? styles.unitAccent : styles.unitDefault]}>
            {unit}
          </Text>
        )}
      </View>

      {/* Sub text */}
      {sub != null && (
        <Text style={[styles.sub, accent ? styles.subAccent : styles.subDefault]}>
          {sub}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    flex: 1,
    minWidth: 0,
  },

  // Overline label
  label: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    letterSpacing: 1.6,   // ~0.16em at 10px
    textTransform: 'uppercase',
    lineHeight: 10,
  },
  labelDefault: {
    color: colors.slate[500],
  },
  labelAccent: {
    color: 'rgba(255,255,255,0.65)',
  },

  // Value
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  value: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 28,
    letterSpacing: -0.56,  // ~-0.02em at 28px
    lineHeight: 28,
  },
  valueDefault: {
    color: colors.ink[900],
  },
  valueAccent: {
    color: '#ffffff',
  },

  // Unit
  unit: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    letterSpacing: 1.44,   // ~0.12em at 12px
    marginLeft: 4,
  },
  unitDefault: {
    color: colors.slate[500],
  },
  unitAccent: {
    color: 'rgba(255,255,255,0.65)',
  },

  // Sub text
  sub: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    marginTop: 6,
  },
  subDefault: {
    color: colors.slate[500],
  },
  subAccent: {
    color: 'rgba(255,255,255,0.65)',
  },
});
