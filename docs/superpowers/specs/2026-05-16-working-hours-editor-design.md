# Working Hours Editor — Design Spec

**Goal:** Owner can view and edit shop working hours from the mobile settings screen.

**Architecture:** A new `WorkingHoursEditor` component lives in `apps/mobile/components/` and is rendered inline inside the existing `settings.tsx` ScrollView. Draft state is kept locally; a single Supabase `update` call fires on explicit "Kaydet" tap. Visual design (colors, spacing, exact layout) is handled separately by Claude Design.

**Tech Stack:** React Native, `@react-native-community/datetimepicker@8.0.1` (already installed), `@berber/shared` types, Supabase JS client.

---

## 1. Data Model

`WorkingHours` is already defined in `packages/shared/src/types.ts`:

```ts
export interface WorkingDayHours {
  open: string | null;   // "09:00" (HH:MM 24h) or null when disabled
  close: string | null;  // "19:00" or null when disabled
  enabled: boolean;
}
export type WorkingHours = Record<DayKey, WorkingDayHours>;
// DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
```

DB column: `shops.working_hours JSONB NOT NULL DEFAULT '{}'`.

**Default for empty/missing days:**
```ts
{ enabled: false, open: null, close: null }
```
Applied when `working_hours` comes back as `{}` (new shop) or a day key is missing.

**Time string format:** `"HH:MM"` 24-hour. DateTimePicker returns a `Date`; it is converted with:
```ts
function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

---

## 2. Component Structure

**New file:** `apps/mobile/components/WorkingHoursEditor.tsx`

```ts
interface WorkingHoursEditorProps {
  shopId: string;
  initialHours: WorkingHours;
  onSaved?: () => void;
}
```

**Internal state:**
- `draft: WorkingHours` — copy of initialHours, mutated on user interaction
- `saving: boolean` — true while Supabase update is in flight
- `pickerTarget: { day: DayKey; field: "open" | "close" } | null` — which cell has the picker open

**Modified file:** `apps/mobile/app/(owner)/settings.tsx`
- `loadAccount` query gains `working_hours` in the select string
- `workingHours` state added (`WorkingHours | null`)
- `<WorkingHoursEditor shopId={shopId} initialHours={workingHours} />` rendered as a new section inside the ScrollView

---

## 3. Behavior

### Day row layout
Each of 7 days renders one row:
- Day name in Turkish (Pazartesi, Salı, … Pazar)
- Enabled toggle (Switch)
- When `enabled: true`: two tappable time chips — "Açılış: 09:00" and "Kapanış: 19:00"
- When `enabled: false`: time chips hidden or grayed-out, not tappable

### Time picker flow
- User taps a time chip → `pickerTarget` set → `DateTimePicker` shown
  - iOS: `display="spinner"`, shown inline with a "Tamam" button to dismiss
  - Android: `display="default"` (system dialog), dismisses automatically on selection
- On change: `toTimeString(date)` stored into `draft[day][field]`
- On dismiss (iOS "Tamam" or Android cancel): `pickerTarget = null`

### Save flow
- "Kaydet" button is **disabled** when `JSON.stringify(draft) === JSON.stringify(initialHours)` or `saving === true`
- On tap: validate → if valid, call `supabase.from("shops").update({ working_hours: draft }).eq("id", shopId)`
- On success: `onSaved?.()`, update `initialHours` reference so button becomes disabled again
- On error: `Alert.alert("Hata", error.message)`, draft preserved (user can retry)

### Validation (on Kaydet tap)
- If any enabled day has `close <= open`: `Alert.alert("Geçersiz saat", "Kapanış saati açılış saatinden önce olamaz.")` and abort save
- Days with `enabled: false` are not validated

### Empty state
If `working_hours` hasn't been set yet (comes as `{}`), all 7 days default to `{ enabled: false, open: null, close: null }`. User enables days and sets times from scratch.

---

## 4. Future Migration Path (A → C)

When a web working hours editor is needed:
1. Move `WorkingHoursEditor.tsx` from `apps/mobile/components/` to `packages/shared/src/`
2. Add the export to `packages/shared/package.json` exports map
3. Update the import in `settings.tsx` from `../../components/WorkingHoursEditor` to `@berber/shared/WorkingHoursEditor`
4. Create a web-adapted wrapper if needed (RN components → web equivalents)

The component boundary is already clean, so this is a file move + import update.

---

## 5. Out of Scope

- Web admin editor (handled separately when needed)
- Per-barber working hours override (currently handled by `appointment_slots` schedule, not `working_hours`)
- Timezone display in the editor (timezone is shop-level, already stored separately)
- Visual styling details — handled by Claude Design
