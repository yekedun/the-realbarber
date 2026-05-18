import { View, Text, Pressable, StyleSheet } from "react-native";
import { T, Type } from "../../lib/theme";

export interface TabBarItem {
  key: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

interface TabBarProps {
  items: TabBarItem[];
  active: string;
  onChange: (key: string) => void;
}

export function TabBar({ items, active, onChange }: TabBarProps) {
  return (
    <View style={styles.bar}>
      {items.map((it) => {
        const isActive = it.key === active;
        const color = isActive ? T.ink900 : T.slate500;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={styles.tab}
          >
            <View
              style={[
                styles.indicator,
                {
                  backgroundColor: isActive ? T.ink900 : "transparent",
                  left: "26%",
                  right: "26%",
                },
              ]}
            />
            <it.Icon size={22} color={color} strokeWidth={1.75} />
            <Text style={[styles.label, { color }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: 74,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: "rgba(247,248,250,0.94)",
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  indicator: {
    position: "absolute",
    top: 0,
    height: 2,
    borderRadius: 1,
  },
  label: {
    fontSize: 10,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 0.4,
  },
});
