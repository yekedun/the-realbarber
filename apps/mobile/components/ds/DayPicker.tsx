import { ScrollView, Pressable, View, Text, StyleSheet } from "react-native";
import { T, R, Type } from "../../lib/theme";

const TR_DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

interface DayPickerProps {
  value: number;
  onChange: (index: number) => void;
  days?: number;
  startDate?: Date;
}

export function DayPicker({
  value,
  onChange,
  days = 7,
  startDate,
}: DayPickerProps) {
  const base = startDate ?? new Date();
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {list.map((d, i) => {
        const isSel = value === i;
        const dayLabel = TR_DAYS_SHORT[(d.getDay() + 6) % 7];
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={[
              styles.cell,
              {
                backgroundColor: isSel ? T.ink900 : T.bgElevated,
                borderColor: isSel ? T.ink900 : T.border,
              },
            ]}
          >
            <Text style={[styles.dayLabel, { color: isSel ? T.fgOnInk : T.fg1, opacity: 0.7 }]}>
              {dayLabel}
            </Text>
            <Text style={[styles.dateNum, { color: isSel ? T.fgOnInk : T.fg1 }]}>
              {d.getDate()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
  },
  cell: {
    width: 56,
    height: 64,
    borderRadius: R.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayLabel: {
    fontSize: 10,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 1.2,
  },
  dateNum: {
    fontSize: 18,
    fontFamily: Type.family,
    fontWeight: Type.weight.bold,
  },
});
