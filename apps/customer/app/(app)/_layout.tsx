import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { T } from "../../lib/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(focused: boolean, name: IoniconName, outlineName: IoniconName) {
  return <Ionicons name={focused ? name : outlineName} size={22} color={focused ? T.navy : T.muted} />;
}

export default function AppLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: T.bg,
          borderTopColor: T.line,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: T.navy,
        tabBarInactiveTintColor: T.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ focused }) => tabIcon(focused, "home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Randevular",
          tabBarIcon: ({ focused }) => tabIcon(focused, "calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => tabIcon(focused, "person", "person-outline"),
        }}
      />
    </Tabs>
  );
}
