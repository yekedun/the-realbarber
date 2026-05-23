import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../lib/theme';

export interface TabItem {
  key: string;
  label: string;
  /** Lucide icon name — render with your icon library, e.g. lucide-react-native */
  icon: string;
}

interface TabBarProps {
  active: string;
  onChange: (key: string) => void;
  items: TabItem[];
  /** Optional icon renderer; receives (iconName, isActive) */
  renderIcon?: (icon: string, isActive: boolean) => React.ReactNode;
}

export function TabBar({ active, onChange, items, renderIcon }: TabBarProps) {
  return (
    <View style={styles.container}>
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => onChange(it.key)}
            activeOpacity={0.7}
            style={styles.tab}
          >
            {/* Top indicator bar */}
            <View style={[styles.indicator, isActive ? styles.indicatorActive : styles.indicatorInactive]} />

            {/* Icon slot */}
            {renderIcon ? (
              renderIcon(it.icon, isActive)
            ) : (
              /* Placeholder box when no icon renderer provided */
              <View style={[styles.iconPlaceholder, { backgroundColor: isActive ? colors.ink[900] : colors.slate[200] }]} />
            )}

            {/* Label */}
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {it.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: 'rgba(247,248,250,0.94)',
    flexDirection: 'row',
    height: 74,
    paddingBottom: 6,
  },

  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },

  // Top indicator strip
  indicator: {
    position: 'absolute',
    top: 0,
    left: '26%',
    right: '26%',
    height: 2,
    borderRadius: 1,
  },
  indicatorActive: {
    backgroundColor: colors.ink[900],
  },
  indicatorInactive: {
    backgroundColor: 'transparent',
  },

  // Icon placeholder (22x22 matching the CSS width/height)
  iconPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },

  // Tab label
  label: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,   // 0.04em at 10px
  },
  labelActive: {
    color: colors.ink[900],
  },
  labelInactive: {
    color: colors.slate[500],
  },
});
