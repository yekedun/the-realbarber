import { Pressable, Text, ScrollView, StyleSheet, ViewStyle } from "react-native";
import { T, R, Type, S } from "../../lib/theme";

interface ChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ children, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? T.ink900 : T.bgElevated,
          borderColor: selected ? T.ink900 : T.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: selected ? T.fgOnInk : T.fg1 }]}>
        {children}
      </Text>
    </Pressable>
  );
}

interface ChipRowProps {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
}

export function ChipRow({ children, padded = true, style }: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.row,
        padded ? { paddingHorizontal: S.s5 } : null,
      ]}
      style={style}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1,
    marginRight: S.s2,
  },
  label: {
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    paddingVertical: S.s1,
  },
});
