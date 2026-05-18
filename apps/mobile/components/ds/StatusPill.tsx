import { Text, StyleSheet } from "react-native";
import { T, Type } from "../../lib/theme";

export type Tone = "ok" | "warn" | "bad" | "neu";

interface StatusPillProps {
  tone?: Tone;
  children: React.ReactNode;
}

const toneMap: Record<Tone, { bg: string; fg: string }> = {
  ok:   { bg: T.mint100,  fg: T.mint700  },
  warn: { bg: T.umber100, fg: T.umber700 },
  bad:  { bg: T.coral100, fg: T.coral700 },
  neu:  { bg: T.slate100, fg: T.fg2      },
};

export function StatusPill({ tone = "ok", children }: StatusPillProps) {
  const { bg, fg } = toneMap[tone];
  return (
    <Text style={[styles.pill, { backgroundColor: bg, color: fg }]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    fontSize: 10,
    fontFamily: Type.family,
    fontWeight: Type.weight.bold,
    letterSpacing: 1.4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
});
