# Working Hours Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner can view and edit shop working hours (7 days, open/close times, enabled toggle) from the mobile settings screen.

**Architecture:** A new `WorkingHoursEditor` component is created in `apps/mobile/components/` and rendered inline inside the existing `settings.tsx` ScrollView. Draft state lives in the component; a single Supabase `update` call fires on explicit "Kaydet" tap. Visual styling follows existing `T` / `R` / `Shadow` theme tokens. Claude Design will later apply final visual polish.

**Tech Stack:** React Native, `@react-native-community/datetimepicker@8.0.1` (already installed), `@berber/shared/types`, `@berber/shared/constants`, Supabase JS client, pnpm monorepo.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/mobile/components/WorkingHoursEditor.tsx` | Full editor component — draft state, day rows, time picker, save |
| Modify | `apps/mobile/app/(owner)/settings.tsx` | Add `working_hours` to DB query, add `workingHours` state, render editor |

---

## Task 1: Create WorkingHoursEditor component

**Files:**
- Create: `apps/mobile/components/WorkingHoursEditor.tsx`

- [ ] **Step 1: Write the component file**

Create `apps/mobile/components/WorkingHoursEditor.tsx` with the full implementation:

```tsx
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { DAY_KEYS, type DayKey } from "@berber/shared/constants";
import type { WorkingHours, WorkingDayHours } from "@berber/shared/types";
import { supabase } from "../lib/supabase";
import { T, R, Shadow } from "../lib/theme";

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Pazartesi",
  tue: "Salı",
  wed: "Çarşamba",
  thu: "Perşembe",
  fri: "Cuma",
  sat: "Cumartesi",
  sun: "Pazar",
};

const ORDERED_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function timeStringToDate(t: string | null): Date {
  const d = new Date();
  if (t) {
    const [h, m] = t.split(":").map(Number);
    d.setHours(h ?? 9, m ?? 0, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function normalizeDraft(raw: WorkingHours | null): WorkingHours {
  const result = {} as WorkingHours;
  for (const day of DAY_KEYS) {
    result[day] = raw?.[day] ?? { enabled: false, open: null, close: null };
  }
  return result;
}

interface WorkingHoursEditorProps {
  shopId: string;
  initialHours: WorkingHours | null;
  onSaved?: () => void;
}

export function WorkingHoursEditor({
  shopId,
  initialHours,
  onSaved,
}: WorkingHoursEditorProps) {
  const [draft, setDraft] = useState<WorkingHours>(() =>
    normalizeDraft(initialHours)
  );
  const [baseline, setBaseline] = useState<WorkingHours>(() =>
    normalizeDraft(initialHours)
  );
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    day: DayKey;
    field: "open" | "close";
  } | null>(null);

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(baseline);

  function toggleDay(day: DayKey) {
    setDraft((prev) => {
      const current = prev[day];
      const enabling = !current.enabled;
      return {
        ...prev,
        [day]: {
          ...current,
          enabled: enabling,
          open: enabling ? (current.open ?? "09:00") : current.open,
          close: enabling ? (current.close ?? "19:00") : current.close,
        },
      };
    });
  }

  function onTimeChange(_event: DateTimePickerEvent, date?: Date) {
    if (!pickerTarget) return;
    if (Platform.OS === "android") setPickerTarget(null);
    if (!date) return;
    const { day, field } = pickerTarget;
    setDraft((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: toTimeString(date) },
    }));
  }

  async function handleSave() {
    for (const day of ORDERED_DAYS) {
      const d = draft[day];
      if (d.enabled && d.open && d.close && d.close <= d.open) {
        Alert.alert(
          "Geçersiz saat",
          `${DAY_LABELS[day]}: kapanış saati açılış saatinden önce olamaz.`
        );
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({ working_hours: draft })
      .eq("id", shopId);
    setSaving(false);

    if (error) {
      Alert.alert("Hata", error.message);
      return;
    }

    setBaseline(draft);
    onSaved?.();
  }

  const pickerValue = pickerTarget
    ? timeStringToDate(draft[pickerTarget.day][pickerTarget.field])
    : new Date();

  return (
    <View>
      <View style={styles.card}>
        {ORDERED_DAYS.map((day, index) => {
          const d = draft[day];
          const isLast = index === ORDERED_DAYS.length - 1;
          return (
            <View
              key={day}
              style={[styles.dayRow, !isLast && styles.dayRowBorder]}
            >
              <Text
                style={[styles.dayLabel, !d.enabled && styles.dayLabelMuted]}
              >
                {DAY_LABELS[day]}
              </Text>
              {d.enabled ? (
                <View style={styles.timePair}>
                  <Pressable
                    onPress={() => setPickerTarget({ day, field: "open" })}
                    style={styles.timeChip}
                  >
                    <Text style={styles.timeText}>{d.open ?? "09:00"}</Text>
                  </Pressable>
                  <Text style={styles.timeSep}>–</Text>
                  <Pressable
                    onPress={() => setPickerTarget({ day, field: "close" })}
                    style={styles.timeChip}
                  >
                    <Text style={styles.timeText}>{d.close ?? "19:00"}</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.closedLabel}>Kapalı</Text>
              )}
              <Switch
                value={d.enabled}
                onValueChange={() => toggleDay(day)}
                trackColor={{ true: T.navy, false: T.line }}
                thumbColor="#fff"
              />
            </View>
          );
        })}
      </View>

      {pickerTarget !== null && (
        <>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onTimeChange}
            minuteInterval={30}
          />
          {Platform.OS === "ios" && (
            <Pressable
              onPress={() => setPickerTarget(null)}
              style={styles.pickerDismiss}
            >
              <Text style={styles.pickerDismissText}>Tamam</Text>
            </Pressable>
          )}
        </>
      )}

      <Pressable
        onPress={handleSave}
        disabled={!isDirty || saving}
        style={({ pressed }) => [
          styles.saveBtn,
          (!isDirty || saving) && styles.saveBtnDisabled,
          pressed && isDirty && { opacity: 0.85 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Kaydet</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: R.card,
    overflow: "hidden",
    ...Shadow.card,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  dayLabel: {
    width: 90,
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
  },
  dayLabelMuted: {
    color: T.muted,
  },
  timePair: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeChip: {
    backgroundColor: T.surfaceAlt,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "600",
    color: T.navy,
  },
  timeSep: {
    fontSize: 13,
    color: T.muted,
  },
  closedLabel: {
    flex: 1,
    fontSize: 13,
    color: T.mutedAlt,
  },
  pickerDismiss: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  pickerDismissText: {
    fontSize: 15,
    fontWeight: "600",
    color: T.navy,
  },
  saveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: T.navy,
    borderRadius: R.cta,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.cta,
  },
  saveBtnDisabled: {
    backgroundColor: T.surfaceAlt,
    ...Shadow.card,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
```

- [ ] **Step 2: Verify the type import path for DayKey**

`DayKey` is exported from `@berber/shared/constants` as a type alias of `(typeof DAY_KEYS)[number]`. Confirm:

```bash
grep -n "DayKey" "packages/shared/src/constants.ts"
```

Expected output includes: `export type DayKey = (typeof DAY_KEYS)[number];`

If not found there, check `packages/shared/src/types.ts` and update the import in `WorkingHoursEditor.tsx` accordingly.

- [ ] **Step 3: Run type-check on mobile**

```bash
cd "apps/mobile" && pnpm type-check
```

Expected: no errors related to `WorkingHoursEditor.tsx`. Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/components/WorkingHoursEditor.tsx"
git commit -m "feat(mobile): add WorkingHoursEditor component"
```

---

## Task 2: Integrate WorkingHoursEditor into settings.tsx

**Files:**
- Modify: `apps/mobile/app/(owner)/settings.tsx`

- [ ] **Step 1: Add `workingHours` state and update `loadAccount`**

In `settings.tsx`, find the existing state declarations near the top of `OwnerSettingsScreen` (around line 40–45) and add:

```tsx
const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
```

Add the import at the top of the file:

```tsx
import type { WorkingHours } from "@berber/shared/types";
import { WorkingHoursEditor } from "../../components/WorkingHoursEditor";
```

- [ ] **Step 2: Update `loadAccount` query to fetch `working_hours`**

Find the existing query inside `loadAccount` (around line 51–56):

```tsx
const { data: shop } = await supabase
  .from("shops")
  .select("display_name, commission_enabled")
  .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
  .single();
setAccount({ name: shop?.display_name ?? "Dükkan", email: user.email ?? "" });
setCommissionEnabled(Boolean(shop?.commission_enabled));
```

Replace with:

```tsx
const { data: shop } = await supabase
  .from("shops")
  .select("display_name, commission_enabled, working_hours")
  .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
  .single();
setAccount({ name: shop?.display_name ?? "Dükkan", email: user.email ?? "" });
setCommissionEnabled(Boolean(shop?.commission_enabled));
setWorkingHours((shop?.working_hours as WorkingHours) ?? null);
```

- [ ] **Step 3: Render WorkingHoursEditor section in JSX**

In the ScrollView JSX, find the `OPERASYON MODÜLLERİ` section (the commission row, around line 147–169). Add the new section **after** that block and **before** the `WIDGET TOKENLARI` section:

```tsx
<View style={styles.secHead}>
  <Text style={styles.secLabel}>ÇALIŞMA SAATLERİ</Text>
</View>

{shopId && workingHours !== null && (
  <WorkingHoursEditor
    shopId={shopId}
    initialHours={workingHours}
  />
)}
```

- [ ] **Step 4: Run type-check**

```bash
cd "apps/mobile" && pnpm type-check
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(owner)/settings.tsx"
git commit -m "feat(mobile): integrate WorkingHoursEditor into owner settings"
```

---

## Task 3: Manual verification

No automated tests exist for RN UI in this repo. Verify manually on device or simulator.

- [ ] **Step 1: Run the app**

```bash
cd "apps/mobile" && npx expo start
```

Open on Android emulator or iOS simulator (or physical device via Expo Go / dev build).

- [ ] **Step 2: Verify initial state**

Navigate to Owner app → Settings (bottom tab). Scroll down — a "ÇALIŞMA SAATLERİ" section should appear with 7 day rows. All days disabled by default if `working_hours` was `{}`.

- [ ] **Step 3: Verify toggle**

Tap the toggle on "Pazartesi". It should enable the row and show "09:00 – 19:00" time chips. "Kaydet" button should become active (dark navy).

- [ ] **Step 4: Verify time picker**

With Pazartesi enabled, tap "09:00". 
- iOS: spinner picker appears below the rows, "Tamam" button dismisses it. 
- Android: system time dialog appears, auto-dismisses on selection. 
Change to 10:00. The chip should show "10:00".

- [ ] **Step 5: Verify save**

Tap "Kaydet". Button shows spinner briefly, then goes back to disabled (changes are now baseline). Reload the app — the saved hours should reappear correctly.

- [ ] **Step 6: Verify validation**

Enable a day. Set open=19:00, close=09:00. Tap "Kaydet". An alert should appear: "Geçersiz saat: [Gün adı]: kapanış saati açılış saatinden önce olamaz." Save should NOT proceed.

- [ ] **Step 7: Commit if any manual fixes were needed**

```bash
git add -p
git commit -m "fix(mobile): working hours editor manual test fixes"
```

Only commit if you made changes during testing.
