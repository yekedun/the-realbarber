import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

export type StatusPillTone = 'ok' | 'warn' | 'bad' | 'neu';

interface StatusPillProps {
  tone?: StatusPillTone;
  children: React.ReactNode;
}

/**
 * Tone map — matches source exactly:
 *   ok   → mint-100 bg  / mint-700 fg   (positive / active)
 *   warn → umber-100 bg / umber-700 fg  (kazanç / warning)
 *   bad  → coral-100 bg / coral-700 fg  (danger / cancel)
 *   neu  → slate-100 bg / fg-2 fg       (neutral / inactive)
 *
 * Note: source uses `var(--fg-2)` for neu.fg.  In the CSS custom-property
 * ladder, --fg-2 is the secondary heading colour = colors.slate[700].
 */
const TONE_MAP: Record<StatusPillTone, { bg: string; fg: string }> = {
  ok:   { bg: colors.mint[100],  fg: colors.mint[700]  },
  warn: { bg: colors.umber[100], fg: colors.umber[700] },
  bad:  { bg: colors.coral[100], fg: colors.coral[700] },
  neu:  { bg: colors.slate[100], fg: colors.slate[700] },
};

export function StatusPill({ tone = 'neu', children }: StatusPillProps) {
  const { bg, fg } = TONE_MAP[tone];
  return (
    <Text style={[styles.base, { backgroundColor: bg, color: fg }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
    overflow: 'hidden',
    lineHeight: 10,
  },
});
