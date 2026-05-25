# Ayarlar: Link Paylaşma + Bildirim Tercihleri

**Tarih:** 2026-05-25  
**Kapsam:** Mobil usta ekranı (owner) ayarlar sayfası

---

## 1. Rezervasyon Linki Paylaşma

**Nerede:** `ProfileEditorSheet` içindeki mevcut slug kutusu (`slugBox`)

**Değişiklik:**  
Slug kutusuna iki buton eklenir — "Kopyala" ve "Paylaş".

- **Kopyala:** `Clipboard.setStringAsync(url)` ile panoya alır. Buton metni 2 saniye boyunca "Kopyalandı!" olarak değişir, sonra eski haline döner.
- **Paylaş:** React Native `Share.share({ message: url })` açar (native share sheet).

URL formatı: `https://siradaki.app/{slug}`

---

## 2. Bildirim Tercihleri

### 2.1 Veritabanı

```sql
alter table staff
add column if not exists notification_prefs jsonb
default '{"new_appointment":true,"cancellation":true,"daily_summary":true}'::jsonb;
```

Migration dosyası: `supabase/migrations/006_staff_notification_prefs.sql`

### 2.2 UI — Ayarlar Ekranı

Operasyon bölümü ile Widget Bağlantıları arasına yeni **"Bildirimler"** section eklenir.

**Dükkan sahibi (owner):**
- Yeni Randevu → toggle (varsayılan: açık)
- İptal → toggle (varsayılan: açık)
- Günlük Özet → toggle (varsayılan: açık)

**Personel/usta:**
- Sadece Günlük Özet → toggle gösterilir
- Yeni randevu ve iptal satırları hiç render edilmez

Toggle değişince anında `supabase.from('staff').update({ notification_prefs: {...} }).eq('id', staffId)` çalışır.

### 2.3 Backend — Günlük Özet Zamanlaması

**Mevcut:** `daily-summary-push` edge fn sabit 08:00'de pg_cron ile tetikleniyor.

**Yeni davranış:**
- pg_cron job her saat başı çalışacak şekilde güncellenir: `0 * * * *`
- Edge fn içinde her dükkan için şu hesaplama yapılır:
  1. `working_hours`'tan bugünün açılış saati alınır (örn. "09:00")
  2. Açılış saatinden 15 dakika çıkarılır (örn. 08:45)
  3. Şu anki UTC saati == hesaplanan saat ise bildirim gönderilir
  4. `notification_prefs.daily_summary = false` olan staff'a gönderilmez

- Türkiye saati UTC+3 olduğu için karşılaştırma UTC+3 bazında yapılır.
- Dükkan o gün kapalıysa (working_hours'ta open=false) bildirim gönderilmez.

---

## 3. Etkilenen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `apps/mobile/app/(owner)/settings.tsx` | Slug paylaş/kopyala + Bildirimler section |
| `supabase/migrations/006_staff_notification_prefs.sql` | Yeni kolon |
| `supabase/functions/daily-summary-push/index.ts` | Saatlik tetik + dinamik zamanlama + pref kontrolü |
| `supabase/migrations` veya Supabase dashboard | pg_cron job güncelleme |
