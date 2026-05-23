/**
 * Staff app tab bar layout — (app) group.
 *
 * Source: index.html StaffApp → TabBar items
 *   { key: 'randevular', icon: 'clock-3',      label: 'Randevular'   }
 *   { key: 'blok',       icon: 'minus-circle', label: 'Takvim Kapat' }
 *   { key: 'hesabim',    icon: 'settings',     label: 'Hesabım'      }
 *
 * TabBar styling (components.jsx TabBar):
 *   borderTop: '1px solid var(--slate-200)'
 *   background: 'rgba(247,248,250,0.94)'
 *   backdropFilter: 'saturate(180%) blur(12px)'
 *   height: 74
 *   paddingBottom: 6
 *   active color: var(--ink-900), inactive: var(--slate-500)
 *   label: 10px, fontWeight 600, letterSpacing 0.04em
 *   indicator: top:0, left:'26%', right:'26%', height:2, borderRadius:1, bg ink-900
 */
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

/**
 * Active-tab indicator — thin 2px line at the top of the active tab.
 * Source (components.jsx):
 *   position: 'absolute', top: 0, left: '26%', right: '26%',
 *   height: 2, borderRadius: 1, background: var(--ink-900)
 */
function TabIndicator({ focused }: { focused: boolean }) {
  if (!focused) return null;
  return <View style={styles.indicator} />;
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.ink[900],
        tabBarInactiveTintColor: colors.slate[500],
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* M9 — Randevular */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Randevular',
          tabBarIcon: ({ focused }) => <TabIndicator focused={focused} />,
        }}
      />

      {/* M10 — Blok */}
      <Tabs.Screen
        name="block"
        options={{
          title: 'Blok',
          tabBarIcon: ({ focused }) => <TabIndicator focused={focused} />,
        }}
      />

      {/* M11 — Hesabım */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Hesabım',
          tabBarIcon: ({ focused }) => <TabIndicator focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  /**
   * TabBar (components.jsx):
   *   borderTop: '1px solid var(--slate-200)'
   *   background: 'rgba(247,248,250,0.94)'
   *   height: 74
   *   paddingBottom: 6
   */
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: 'rgba(247,248,250,0.94)',
    height: 74,
    paddingBottom: 6,
  },

  /**
   * Tab label: fontSize 10, fontWeight 600, letterSpacing 0.04em
   * 0.04em at 10px = 0.4
   */
  tabLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },

  /**
   * Active indicator: top:0, left~26%, right~26% → 48% width centred,
   * height 2, borderRadius 1, bg ink-900
   */
  indicator: {
    position: 'absolute',
    top: 0,
    width: '48%',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.ink[900],
  },
});
