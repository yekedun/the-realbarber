import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { T, R, Type } from "../../lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  onPress?: () => void;
  full?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const variantMap: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary:   { bg: T.ink900,    fg: T.fgOnInk,   border: T.ink900    },
  accent:    { bg: T.brand600,  fg: T.fgOnAccent, border: T.brand700  },
  secondary: { bg: "transparent", fg: T.ink900,   border: T.ink900    },
  ghost:     { bg: "transparent", fg: T.ink900,   border: "transparent" },
  danger:    { bg: "transparent", fg: T.coral600, border: T.coral600  },
};

const sizeMap: Record<Size, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 34, paddingHorizontal: 12, fontSize: 13 },
  md: { height: 44, paddingHorizontal: 18, fontSize: 14 },
  lg: { height: 52, paddingHorizontal: 20, fontSize: 15 },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  onPress,
  full = false,
  disabled = false,
  style,
}: ButtonProps) {
  const v = variantMap[variant];
  const s = sizeMap[size];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          backgroundColor: v.bg,
          borderColor: v.border,
          alignSelf: full ? "stretch" : "flex-start",
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { fontSize: s.fontSize, color: v.fg }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: R.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  label: {
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: -0.07,
  },
});
