import { View, Text, StyleSheet } from "react-native";
import { T, Type, S } from "../../lib/theme";
import { Card } from "./Card";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
}

export function KpiCard({ label, value, unit, sub, accent = false }: KpiCardProps) {
  const metaColor = accent ? "rgba(255,255,255,0.65)" : T.slate500;
  const valueColor = accent ? T.fgOnAccent : T.ink900;
  return (
    <Card accent={accent} style={styles.card}>
      <Text style={[styles.label, { color: metaColor }]} numberOfLines={2}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        {unit && (
          <Text style={[styles.unit, { color: metaColor }]}>{unit}</Text>
        )}
      </View>
      {sub && <Text style={[styles.sub, { color: metaColor }]}>{sub}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  label: {
    fontSize: 10,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 0.8,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 10,
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontFamily: Type.family,
    fontWeight: Type.weight.bold,
    letterSpacing: -0.56,
    lineHeight: 28,
  },
  unit: {
    fontSize: 12,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 1.44,
    marginBottom: 2,
  },
  sub: {
    fontSize: 11,
    fontFamily: Type.family,
    marginTop: 6,
  },
});
