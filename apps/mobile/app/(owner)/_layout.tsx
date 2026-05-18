import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { BarChart2, Calendar, Users, CreditCard, Settings } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { T } from "../../lib/theme";
import { useUserRole } from "../../lib/user-context";

export default function OwnerLayout() {
  const { shopId } = useUserRole();
  const [commissionEnabled, setCommissionEnabled] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    Promise.resolve(
      supabase
        .from("shops")
        .select("commission_enabled")
        .eq("id", shopId)
        .single()
    )
      .then(({ data }) => setCommissionEnabled(Boolean(data?.commission_enabled)))
      .catch(() => setCommissionEnabled(false));
  }, [shopId]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.brand600,
        tabBarInactiveTintColor: T.fg3,
        tabBarStyle: {
          backgroundColor: T.bg,
          borderTopColor: T.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 28,
          height: 76,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Özet",
          tabBarIcon: ({ color }) => <BarChart2 size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Ajanda",
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Ekip",
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Kazanç",
          href: commissionEnabled ? undefined : null,
          tabBarIcon: ({ color }) => <CreditCard size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ayarlar",
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
