# Commission Per-Barber + Settings Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove shop-level commission toggle; make commission fully per-barber with explicit toggle in team screen; rename the settings section header from "OPERASYON MODÜLLERİ" to "DÜKKAN AYARLARI".

**Architecture:** Two file edits only. No new components, no DB migrations. The `staff_commission_configs` table already stores per-barber `commission_type: "none" | "percentage"` — the UI just needs to stop gating on `shops.commission_enabled`. Settings screen loses the commission section and gains a renamed header for the working hours editor.

**Tech Stack:** React Native, Expo Router, Supabase JS client, pnpm monorepo. Type-check: `cd apps/mobile && pnpm type-check`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/mobile/app/(owner)/settings.tsx` | Remove commission state/UI, rename section header |
| Modify | `apps/mobile/app/(owner)/team.tsx` | Remove shop-level gate, always load commission, redesign modal with toggle |

---

## Task 1: Restructure Settings screen

**Files:**
- Modify: `apps/mobile/app/(owner)/settings.tsx`

- [ ] **Step 1: Remove commission state and handler**

Find the state block near the top of `OwnerSettingsScreen` (around line 42–48) and the `handleToggleCommission` function (around line 117–131). Replace the entire state block and function with the stripped-down version below.

**Before** (state block, lines ~42–48):
```tsx
const [tokens, setTokens]     = useState<TokenMeta[]>([]);
const [loading, setLoading]   = useState(true);
const [generating, setGenerating] = useState(false);
const [account, setAccount]   = useState<{ name: string; email: string }>({ name: "Sahip", email: "" });
const [commissionEnabled, setCommissionEnabled] = useState(false);
const [savingCommission, setSavingCommission] = useState(false);
const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
```

**After:**
```tsx
const [tokens, setTokens]     = useState<TokenMeta[]>([]);
const [loading, setLoading]   = useState(true);
const [generating, setGenerating] = useState(false);
const [account, setAccount]   = useState<{ name: string; email: string }>({ name: "Sahip", email: "" });
const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
```

Delete the `handleToggleCommission` function entirely (it was ~14 lines using `savingCommission`, `commissionEnabled`, and a Supabase update).

- [ ] **Step 2: Update `loadAccount` — remove commission from query**

Find `loadAccount` (around line 50–61). Replace the Supabase query and the three `set…` calls:

**Before:**
```tsx
const { data: shop } = await supabase
  .from("shops")
  .select("display_name, commission_enabled, working_hours")
  .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
  .single();
setAccount({ name: shop?.display_name ?? "Dükkan", email: user.email ?? "" });
setCommissionEnabled(Boolean(shop?.commission_enabled));
setWorkingHours((shop?.working_hours as unknown as WorkingHours) ?? null);
```

**After:**
```tsx
const { data: shop } = await supabase
  .from("shops")
  .select("display_name, working_hours")
  .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
  .single();
setAccount({ name: shop?.display_name ?? "Dükkan", email: user.email ?? "" });
setWorkingHours((shop?.working_hours as unknown as WorkingHours) ?? null);
```

- [ ] **Step 3: Remove commission JSX section, rename header**

In the ScrollView JSX, find the "OPERASYON MODÜLLERİ" section (the `secHead` + `Pressable` block, ~20 lines). Delete it entirely:

```tsx
{/* DELETE THIS ENTIRE BLOCK: */}
<View style={styles.secHead}>
  <Text style={styles.secLabel}>OPERASYON MODÜLLERİ</Text>
  <Text style={styles.secCount}>{commissionEnabled ? "Açık" : "Kapalı"}</Text>
</View>

<Pressable
  onPress={handleToggleCommission}
  disabled={savingCommission}
  style={({ pressed }) => [styles.moduleRow, (pressed || savingCommission) && { opacity: 0.85 }]}
>
  ...
</Pressable>
```

Then find the "ÇALIŞMA SAATLERİ" section header (just before the WorkingHoursEditor guard):

**Before:**
```tsx
<View style={styles.secHead}>
  <Text style={styles.secLabel}>ÇALIŞMA SAATLERİ</Text>
</View>
```

**After:**
```tsx
<View style={styles.secHead}>
  <Text style={styles.secLabel}>DÜKKAN AYARLARI</Text>
</View>
```

- [ ] **Step 4: Remove now-unused styles**

In the `StyleSheet.create({...})` at the bottom, delete these three entries (they were only used by the commission module row):

```tsx
// DELETE:
moduleRow: {
  paddingVertical: 12, paddingHorizontal: 12, backgroundColor: T.surface,
  borderWidth: 1, borderColor: T.line, borderRadius: R.card,
  flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.card,
},
moduleState: { fontSize: 12, fontWeight: "700", color: T.muted },
moduleStateOn: { color: "#059669" },
```

- [ ] **Step 5: Type-check**

```bash
cd "apps/mobile" && pnpm type-check
```

Expected: zero errors. If TypeScript complains about a deleted variable still being referenced, trace it and delete the reference too.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(owner)/settings.tsx"
git commit -m "refactor(mobile): remove shop commission toggle, rename section to DÜKKAN AYARLARI"
```

---

## Task 2: Per-barber commission in Team screen

**Files:**
- Modify: `apps/mobile/app/(owner)/team.tsx`

- [ ] **Step 1: Add `Switch` to React Native imports and add `commissionOn` toggle state**

First, find the React Native import at the top of the file and add `Switch`:

**Before:**
```tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
```

**After:**
```tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
} from "react-native";
```

Then find the state declarations in `TeamScreen` (around line 52–66). Add one new state variable after `commissionInput`:

**Before:**
```tsx
const [commissionStaff, setCommissionStaff] = useState<Staff | null>(null);
const [commissionInput, setCommissionInput] = useState("");
const [savingCommission, setSavingCommission] = useState(false);
```

**After:**
```tsx
const [commissionStaff, setCommissionStaff] = useState<Staff | null>(null);
const [commissionInput, setCommissionInput] = useState("");
const [commissionOn, setCommissionOn] = useState(false);
const [savingCommission, setSavingCommission] = useState(false);
```

Also delete the `commissionEnabled` state line:
```tsx
// DELETE:
const [commissionEnabled, setCommissionEnabled] = useState(false);
```

- [ ] **Step 2: Rewrite `load()` — remove shop query, always fetch commission**

Replace the entire `load` useCallback with:

```tsx
const load = useCallback(async () => {
  if (!shopId) return;
  const [{ data }, { data: commissionRows, error: commissionError }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, slug, is_active, user_id")
      .eq("shop_id", shopId)
      .order("created_at"),
    supabase.rpc("get_staff_commission_configs", { p_shop_id: shopId }),
  ]);
  if (commissionError) Alert.alert("Hata", commissionError.message);
  const commissionByStaff = new Map(
    ((commissionRows as StaffCommissionConfig[] | null) ?? []).map((row) => [row.staff_id, row])
  );
  setStaffList(
    ((data as Omit<Staff, "commission_type" | "commission_rate_bps">[] | null) ?? []).map((staff) => {
      const commission = commissionByStaff.get(staff.id);
      return {
        ...staff,
        commission_type: commission?.commission_type ?? "none",
        commission_rate_bps: commission?.commission_rate_bps ?? null,
      };
    })
  );
  setLoading(false);
}, [shopId]);
```

- [ ] **Step 3: Update `openCommissionModal` — set toggle from current state**

**Before:**
```tsx
function openCommissionModal(staffMember: Staff) {
  setCommissionStaff(staffMember);
  setCommissionInput(staffMember.commission_rate_bps != null ? String(staffMember.commission_rate_bps / 100) : "");
}
```

**After:**
```tsx
function openCommissionModal(staffMember: Staff) {
  setCommissionStaff(staffMember);
  setCommissionOn(staffMember.commission_type === "percentage");
  setCommissionInput(staffMember.commission_rate_bps != null ? String(staffMember.commission_rate_bps / 100) : "");
}
```

- [ ] **Step 4: Update `closeCommissionModal` — clear toggle**

**Before:**
```tsx
function closeCommissionModal() {
  if (savingCommission) return;
  setCommissionStaff(null);
  setCommissionInput("");
}
```

**After:**
```tsx
function closeCommissionModal() {
  if (savingCommission) return;
  setCommissionStaff(null);
  setCommissionInput("");
  setCommissionOn(false);
}
```

- [ ] **Step 5: Rewrite `saveCommission` — use toggle, require rate when on**

**Before:**
```tsx
async function saveCommission() {
  if (!commissionStaff) return;
  const trimmed = commissionInput.trim().replace(",", ".");
  if (!trimmed) {
    await updateCommission(commissionStaff.id, "none", null);
    return;
  }
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    Alert.alert("Geçersiz", "0 ile 100 arasında oran gir.");
    return;
  }
  await updateCommission(commissionStaff.id, "percentage", Math.round(percent * 100));
}
```

**After:**
```tsx
async function saveCommission() {
  if (!commissionStaff) return;
  if (!commissionOn) {
    await updateCommission(commissionStaff.id, "none", null);
    return;
  }
  const trimmed = commissionInput.trim().replace(",", ".");
  if (!trimmed) {
    Alert.alert("Geçersiz", "Komisyon oranı gir.");
    return;
  }
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    Alert.alert("Geçersiz", "0 ile 100 arasında oran gir.");
    return;
  }
  await updateCommission(commissionStaff.id, "percentage", Math.round(percent * 100));
}
```

- [ ] **Step 6: Update staff card JSX — remove `commissionEnabled` guards**

In the staff card render (inside `staffList.map`), find the two `commissionEnabled &&` guarded blocks and remove the condition so they always render.

**Commission icon button — Before:**
```tsx
{commissionEnabled && (
  <Pressable
    onPress={() => openCommissionModal(b)}
    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    hitSlop={8}
  >
    <Feather name="percent" size={18} color={T.navy} />
  </Pressable>
)}
```

**After:**
```tsx
<Pressable
  onPress={() => openCommissionModal(b)}
  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
  hitSlop={8}
>
  <Feather name="percent" size={18} color={T.navy} />
</Pressable>
```

**Commission text — Before:**
```tsx
{commissionEnabled && (
  <Text style={styles.commissionText}>
    {b.commission_type === "percentage" && b.commission_rate_bps != null
      ? `%${b.commission_rate_bps / 100} komisyon`
      : "Komisyon yok"}
  </Text>
)}
```

**After:**
```tsx
<Text style={styles.commissionText}>
  {b.commission_type === "percentage" && b.commission_rate_bps != null
    ? `%${b.commission_rate_bps / 100} komisyon`
    : "Komisyon yok"}
</Text>
```

- [ ] **Step 7: Redesign commission Modal JSX**

Find the `{/* Komisyon Modalı */}` block (around line 392–422). Replace the entire modal with:

```tsx
{/* Komisyon Modalı */}
<Modal visible={commissionStaff !== null} transparent animationType="fade" onRequestClose={closeCommissionModal}>
  <View style={styles.modalBackdrop}>
    <View style={styles.commissionModal}>
      <Text style={styles.modalTitle}>Komisyon Ayarı</Text>
      <Text style={styles.modalText}>{commissionStaff?.name} için komisyon ayarı.</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Komisyon aktif</Text>
        <Switch
          value={commissionOn}
          onValueChange={(v) => {
            setCommissionOn(v);
            if (!v) setCommissionInput("");
          }}
          trackColor={{ true: T.navy, false: T.line }}
          thumbColor="#fff"
          disabled={savingCommission}
        />
      </View>
      {commissionOn && (
        <TextInput
          value={commissionInput}
          onChangeText={setCommissionInput}
          placeholder="Örn. 50"
          keyboardType="decimal-pad"
          style={styles.commissionInput}
          editable={!savingCommission}
        />
      )}
      <View style={styles.modalActions}>
        <Pressable onPress={closeCommissionModal} disabled={savingCommission} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Vazgeç</Text>
        </Pressable>
        <Pressable
          onPress={saveCommission}
          disabled={savingCommission}
          style={({ pressed }) => [styles.primaryBtn, (pressed || savingCommission) && { opacity: 0.85 }]}
        >
          {savingCommission ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Kaydet</Text>}
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
```

- [ ] **Step 8: Add missing styles for toggle row**

In `StyleSheet.create({...})` at the bottom, add after the existing `commissionText` style:

```tsx
toggleRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 14,
},
toggleLabel: {
  fontSize: 14,
  fontWeight: "600",
  color: T.ink,
},
```

- [ ] **Step 9: Type-check**

```bash
cd "apps/mobile" && pnpm type-check
```

Expected: zero errors. Fix any remaining references to the deleted `commissionEnabled` variable.

- [ ] **Step 10: Commit**

```bash
git add "apps/mobile/app/(owner)/team.tsx"
git commit -m "feat(mobile): per-barber commission toggle, remove shop-level gate"
```

---

## Task 3: Manual verification

No automated RN tests in this repo. Verify on device/emulator via `npx expo run:android`.

- [ ] **Step 1: Settings screen**
  - Navigate to Owner app → Settings tab
  - Confirm "OPERASYON MODÜLLERİ" / komisyon toggle is gone
  - Confirm working hours section header reads "DÜKKAN AYARLARI"
  - Confirm WorkingHoursEditor still renders and save still works

- [ ] **Step 2: Team screen — commission always visible**
  - Navigate to Owner app → Ekip tab
  - Confirm `%` icon button appears on every staff card (not gated)
  - Confirm "Komisyon yok" text appears on cards where commission is off
  - Confirm commission text shows `%X komisyon` on cards where commission was already set

- [ ] **Step 3: Commission modal — toggle off**
  - Tap `%` on a staff member with no commission
  - Confirm toggle defaults to OFF, rate input hidden
  - Tap Kaydet → confirm saves as "none", card still shows "Komisyon yok"

- [ ] **Step 4: Commission modal — toggle on**
  - Tap `%` on a staff member
  - Toggle to ON → confirm rate input appears
  - Enter "50" → tap Kaydet
  - Confirm card now shows `%50 komisyon`

- [ ] **Step 5: Commission modal — toggle off after setting**
  - Tap `%` on a staff member with `%50 komisyon`
  - Confirm toggle defaults to ON, rate input shows "50"
  - Toggle to OFF → confirm rate input disappears
  - Tap Kaydet → confirm card returns to "Komisyon yok"
