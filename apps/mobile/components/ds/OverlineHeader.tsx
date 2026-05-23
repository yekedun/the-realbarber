import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';

interface OverlineHeaderProps {
  eyebrow: string;
  title: string;
  meta?: string;
  trailing?: React.ReactNode;
  dark?: boolean;
}

export function OverlineHeader({
  eyebrow,
  title,
  meta,
  trailing = null,
  dark = false,
}: OverlineHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={[styles.eyebrow, dark ? styles.eyebrowDark : styles.eyebrowLight]}>
          {eyebrow}
        </Text>
        <Text style={[styles.title, dark ? styles.titleDark : styles.titleLight]}>
          {title}
        </Text>
        {meta != null && (
          <Text style={[styles.meta, dark ? styles.metaDark : styles.metaLight]}>
            {meta}
          </Text>
        )}
      </View>
      {trailing != null && (
        <View style={styles.trailing}>{trailing}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },

  left: {
    minWidth: 0,
    flex: 1,
  },

  trailing: {
    flexShrink: 0,
  },

  // Eyebrow (overline)
  eyebrow: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,   // 0.16em at 11px
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  eyebrowLight: {
    color: colors.slate[500],
  },
  eyebrowDark: {
    color: 'rgba(245,242,236,0.6)',
  },

  // H1 title
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 32,
    letterSpacing: -0.64,  // -0.02em at 32px
    lineHeight: 33.6,      // 1.05
    marginTop: 10,
  },
  titleLight: {
    color: colors.ink[900],
  },
  titleDark: {
    color: '#ffffff',
  },

  // Meta
  meta: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    marginTop: 8,
  },
  metaLight: {
    color: colors.slate[500],
  },
  metaDark: {
    color: colors.slate[400],
  },
});
