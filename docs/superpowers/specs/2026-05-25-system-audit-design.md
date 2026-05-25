# System Integration Audit — Design Spec
**Date:** 2026-05-25  
**Status:** Approved

## Amaç

Sistemdeki her DB objesi (tablo, RPC, trigger, RLS policy, realtime), her edge function ve her frontend ekranının bağlantı durumunu haritalamak; eksik/kırık bağlantıları tespit etmek. Bu audit Sub-B'nin (otomatik E2E test suite + CI gate) temelidir.

---

## Kapsam

| Katman | Objeler |
|--------|---------|
| DB functions | ~20 RPC/fn: `create_appointment_atomic`, `schedule_has_conflict`, `get_occupied_ranges`, `complete_appointment_with_revenue`, `get_staff_commission_configs`, `assign_any_staff`, vb. |
| DB triggers | 6: `shops_updated_at`, `barbers_updated_at`, `appointments_sync_slots`, `blocks_sync_slots`, `shops_ensure_owner_staff`, `appointments_prevent_direct_scheduling_writes` |
| Edge functions | 9: `app-book-appointment`, `app-cancel-appointment`, `block-walkin`, `create-manual-block`, `create-widget-token`, `delete-account`, `invite-barber`, `widget-book-appointment`, `widget-get-availability` |
| Mobil ekranlar | 12 ekran: (auth) register; (app) index/block/settings; (owner) index/agenda/earnings/onboarding/services/settings/team |
| Web | `[slug]/page.tsx`, `api/availability/route.ts`, landing + legal sayfalar |
| Dış servisler | Supabase Auth (invite/delete), push notif (planlı), Sentry/analytics (planlı) |

---

## Çıktı Dosyaları

```
scripts/
  audit/
    build-map.ts    ← statik analiz
    probe.ts        ← runtime probe
    types.ts        ← ortak tipler

docs/
  audit/
    integration-map.md    ← producer × consumer matrix
    gaps.md               ← önceliklendirilmiş eksik/kırık bağlantılar
    probe-results.json    ← ham PASS/FAIL sonuçları
    probe-summary.md      ← insan-okunur özet
```

`package.json`'a `"audit": "tsx scripts/audit/build-map.ts && tsx scripts/audit/probe.ts"` eklenir.

---

## Faz A — Statik Analiz (`build-map.ts`)

### Girdiler
- `supabase/migrations/*.sql` — tablo, trigger, RPC tanımları
- `supabase/functions/*/index.ts` — edge fn kaynak kodları
- `apps/mobile/app/**/*.tsx` — from/rpc/channel/invoke çağrıları
- `apps/web/src/**/*.tsx` — aynı

### İşlem
1. Migration'lardan: tüm `CREATE TABLE`, `CREATE FUNCTION`, `CREATE TRIGGER`, `ALTER TABLE ENABLE ROW LEVEL SECURITY` satırlarını çıkar
2. Edge fn'lardan: `supabase.from(X)`, `supabase.rpc(X)`, doğrudan SQL referanslarını çıkar
3. Uygulama kodundan: `supabase.from(X)`, `supabase.rpc(X)`, `supabase.channel(X)`, `functions.invoke(X)` çıkar
4. Cross-reference matrix kur: her producer için consumer listesi, her consumer için producer var mı?
5. Gap kuralları:
   - 🔴 CRITICAL: Consumer çağırıyor ama producer tanımlı değil
   - 🟡 WARNING: Producer tanımlı ama hiçbir consumer yok
   - 🟢 INFO: Dış servis eksikliği (push/Sentry — beklenen, planda)

### Çıktı
- `integration-map.md` — tablolar, her objenin tanımlandığı migration + çağıran consumer'lar
- `gaps.md` — gap listesi öncelik sırasıyla

---

## Faz B — Runtime Probe (`probe.ts`)

**Ön koşul:** `supabase start` ile lokal Supabase (`http://127.0.0.1:54201`) ayakta.

### RPC Probing
Her public RPC: minimal geçerli argümanla çağır, HTTP 200 ve non-error yanıt beklenir. Arg üretemiyorsak skip + uyarı.

### Edge Function Probing
Her edge fn için 3 senaryo:
- `anon` token → beklenen davranış (genellikle 401 veya fn-specific)
- `owner` JWT → başarılı veya beklenen iş mantığı hatası
- `barber` JWT → başarılı veya 403

### RLS Probing
Her tablo için:
- Anon `SELECT` → 0 satır veya 403 (tabloya göre)
- Owner kendi shop'unu okur → ≥0 satır, hata yok
- Barber kendi randevularını okur → ≥0 satır, hata yok

### Trigger Probing
Her trigger için:
- Test satırı insert/update et
- Beklenen yan etkiyi doğrula (örn. `appointments_sync_slots` → `appointment_slots` tablosunda satır oluştu)
- Test sonrası temizle (rollback veya delete)

### Realtime Probing
- `appointments` kanalına subscribe ol
- Test randevusu insert et
- 3 saniye içinde `INSERT` event geldi mi?

### Çıktı
- `probe-results.json` — `{ check: string, status: "PASS"|"FAIL"|"SKIP", message: string }[]`
- `probe-summary.md` — kategori bazlı PASS/FAIL tablosu + toplam skor

---

## Gap Önceliklendirme Kriterleri (`gaps.md`)

| Seviye | Kriter | Örnek |
|--------|--------|-------|
| 🔴 CRITICAL | Uygulama çalışırken patlar | Mobil ekran var olmayan RPC çağırıyor |
| 🟡 WARNING | Özellik eksik ama crash yok | Edge fn tanımlı ama hiçbir yerden invoke edilmiyor |
| 🟢 INFO | Beklenen eksiklik, planda var | Push notif altyapısı yok |

---

## Kapsam Dışı (Sub-B)

- Otomatik E2E test suite (bu audit'in çıktısından üretilecek)
- CI gate entegrasyonu
- Production Supabase'e karşı probe (lokal only)
