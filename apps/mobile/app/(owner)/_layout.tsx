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
 */
import { Tabs } from 'expo-router';
import { BarChart3, CalendarDays, Wallet, Users, Settings } from 'lucide-react-native';
import { colors } from '../../lib/theme';

const ICON_SIZE = 20;

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
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Özet',
          tabBarIcon: ({ color }) => <BarChart3 size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Ajanda',
          tabBarIcon: ({ color }) => <CalendarDays size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Kazanç',
          tabBarIcon: ({ color }) => <Wallet size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Ekip',
          tabBarIcon: ({ color }) => <Users size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color }) => <Settings size={ICON_SIZE} color={color} />,
        }}
      />
      {/* Non-tab screens — hidden from tab bar */}
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="services"   options={{ href: null }} />
    </Tabs>
  );
}
