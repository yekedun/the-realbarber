import { Text, StyleSheet, ViewStyle } from "react-native";
import { T, Type, S } from "../../lib/theme";

interface SectionLabelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <Text style={[styles.label, style]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 1.76,
    color: T.slate500,
    paddingHorizontal: S.s5,
    marginTop: S.s6,
    marginBottom: S.s2 + 2,
  },
});
