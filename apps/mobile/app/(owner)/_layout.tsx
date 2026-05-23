/**
 * Owner Tab Layout
 * Source: index.html — OwnerApp TabBar items + components.jsx TabBar styles
 *
 * Tab items (source order):
 *   { key:'ozet',    icon:'bar-chart-3',   label:'Özet'    }
 *   { key:'ajanda',  icon:'calendar-days', label:'Ajanda'  }
 *   { key:'kazanc',  icon:'wallet',        label:'Kazanç'  }
 *   { key:'ekip',    icon:'users',         label:'Ekip'    }
 *   { key:'ayarlar', icon:'settings',      label:'Ayarlar' }
 *
 * TabBar styles (components.jsx TabBar):
 *   borderTop: '1px solid var(--slate-200)'
 *   background: 'rgba(247,248,250,0.94)'
 *   height: 74
 *   paddingBottom: 6
 *   active color:   ink-900
 *   inactive color: slate-500
 *   label: fontSize:10 fontWeight:600 letterSpacing:0.04em
 *
 * Hidden screens (href:null): onboarding, services
 */
import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(247,248,250,0.94)',
          borderTopColor: colors.slate[200],
          borderTopWidth: 1,
          height: 74,
          paddingBottom: 6,
        },
        tabBarActiveTintColor:   colors.ink[900],
        tabBarInactiveTintColor: colors.slate[500],
        tabBarLabelStyle: {
          fontFamily: 'Montserrat-SemiBold',
          fontSize: 10,
          letterSpacing: 0.4,    // 0.04em × 10
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Özet'    }} />
      <Tabs.Screen name="agenda"   options={{ title: 'Ajanda'  }} />
      <Tabs.Screen name="earnings" options={{ title: 'Kazanç'  }} />
      <Tabs.Screen name="team"     options={{ title: 'Ekip'    }} />
      <Tabs.Screen name="settings" options={{ title: 'Ayarlar' }} />
      {/* Non-tab screens — hidden from tab bar */}
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="services"   options={{ href: null }} />
    </Tabs>
  );
}
