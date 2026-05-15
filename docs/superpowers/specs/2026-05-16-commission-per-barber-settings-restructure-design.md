# Commission Per-Barber + Settings Restructure — Design Spec

**Date:** 2026-05-16  
**Status:** Approved

---

## Goal

Move commission configuration from a shop-level on/off toggle to a per-barber toggle+rate. Clean up the Settings screen by removing the commission section and giving shop-level settings (working hours) a proper home.

---

## Current State

### Settings screen (`(owner)/settings.tsx`)
- Account card
- OPERASYON MODÜLLERİ section → "Komisyon takibi" toggle (shop-wide on/off)
- ÇALIŞMA SAATLERİ section → WorkingHoursEditor
- WIDGET TOKENLARI section → widget tokens
- Sign out

### Team screen (`(owner)/team.tsx`)
- Staff cards with: avatar, name, status chip, slug, commission text
- Commission `%` icon button — **only visible if `shops.commission_enabled = true`**
- Commission modal: text input for percentage, empty = "none"

### Database
- `shops.commission_enabled` (boolean) — shop-level gate
- `staff_commission_configs` table — already stores per-barber `commission_type: "none" | "percentage"` and `commission_rate_bps`

The data model is already per-barber. The shop-level toggle is only a UI gate.

---

## Design

### 1. Settings screen — remove commission, rename section

**Remove:**
- `commissionEnabled` state
- `savingCommission` state  
- `handleToggleCommission` function
- `loadAccount` query for `commission_enabled`
- Entire "OPERASYON MODÜLLERİ" section from JSX

**Change:**
- Rename section header "ÇALIŞMA SAATLERİ" → "DÜKKAN AYARLARI"
- The WorkingHoursEditor stays under this renamed header

**Result — Settings screen sections:**
1. Account card (unchanged)
2. DÜKKAN AYARLARI → WorkingHoursEditor
3. WIDGET TOKENLARI → widget tokens (unchanged)
4. Sign out (unchanged)

No database migration needed. `shops.commission_enabled` column stays but is no longer read by the app.

---

### 2. Team screen — per-barber commission toggle

**Remove shop-level gate:**
- Remove `commissionEnabled` state and the `if (commissionEnabled)` guards
- Always fetch commission configs on load (remove the `if (Boolean(shop?.commission_enabled))` block)
- Always show commission `%` icon button per staff card
- Always show commission text under staff name

**Commission modal redesign:**

Current modal has only a text input for the percentage. New modal adds an explicit toggle at the top:

```
┌─────────────────────────────────┐
│  Komisyon Ayarı                 │
│  Ahmet Usta için                │
│                                 │
│  Komisyon aktif  [  Toggle  ]   │
│                                 │
│  [if toggled on:]               │
│  Oran (%)                       │
│  [  50  __________________ ]    │
│                                 │
│         [ Vazgeç ]  [ Kaydet ]  │
└─────────────────────────────────┘
```

**Toggle logic:**
- Toggle ON → `commission_type = "percentage"`, rate input becomes visible
- Toggle OFF → `commission_type = "none"`, rate input hidden, rate cleared
- On open: toggle is ON if `commission_type === "percentage"`, OFF if `"none"`
- On save: if toggle OFF → call `update_staff_commission_config` with `commission_type: "none"`. If toggle ON → validate rate (0–100, required), call with `commission_type: "percentage"` and rate.

**Staff card commission text (always visible):**
- `commission_type === "percentage"` → `%{rate} komisyon`
- `commission_type === "none"` → `Komisyon yok` (shown in muted color, not hidden)

**`load()` function cleanup:**
- Remove the `if (Boolean(shop?.commission_enabled))` guard
- Always call `get_staff_commission_configs` RPC
- Remove the `shop` query for `commission_enabled` (only needed for commission gate)

Wait: `load()` still needs `shops.commission_enabled` check for... actually nothing anymore. The `shop` query fetches only `commission_enabled`. If we drop that, `load()` simplifies to just the two staff queries.

---

### 3. What does NOT change

- `StaffScheduleModal` (per-barber daily hours) — untouched
- WorkingHoursEditor component — untouched
- Widget token management — untouched
- `staff_commission_configs` DB table — untouched
- `update_staff_commission_config` RPC — untouched
- `get_staff_commission_configs` RPC — untouched
- Navigation tabs (Ajanda | Ekip | Ayarlar) — no new tab

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `apps/mobile/app/(owner)/settings.tsx` | Remove commission section, rename DÜKKAN AYARLARI header |
| Modify | `apps/mobile/app/(owner)/team.tsx` | Remove shop-level gate, redesign commission modal with toggle |

---

## Scope Check

This is a self-contained UI refactor. No migrations, no new components, no new API calls. Two file edits.
