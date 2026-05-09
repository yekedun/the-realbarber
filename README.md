# Berber Randevu Sistemi

Modern, ölçeklenebilir ve çok oyunculu (multi-tenant) online berber randevu yönetim platformu. 

## 🏗 Yeni Mimari (Multi-seat & Schedules)

Eski sürümdeki tek dükkan - tek usta mimarisi, tamamen **çoklu personel (Multi-seat)** ve **dinamik çalışma saatleri (Schedules)** altyapısına geçirilmiştir. 

### 1. Multi-Tenant ve Staff Yönetimi
- `shops`: Sistemin ana tenant tablosudur. Her dükkan kendi çalışma saatlerine (fallback olarak) sahiptir ve kendi personellerini barındırır.
- `staff`: Dükkanlara bağlı çalışan personelleri ifade eder. Müşteriler randevularını doğrudan belirli bir personele alabilir veya "Fark Etmez" seçeneğiyle (otomatik atama) rastgele uygun bir personele yönlendirilebilirler.
- Tüm RLS politikaları `shop_id` bazlı sınırlandırılarak Cross-Tenant veri sızıntıları (Cross-Tenant leaks) engellenmiştir.

### 2. Staff Schedules (Dinamik Çalışma ve Mola Saatleri)
- `staff_schedules` tablosu, her personelin haftanın her gününe özel çalışma saatlerini (`work_start`, `work_end`) ve mola zamanlarını (`break_start`, `break_end`) tutar.
- Mola saatleri, randevu uygunluk algoritmasında otomatik olarak "dolu" sayılır (bloklanmış aralık).
- Müşteriler, iptal politikası kapsamında randevularını sadece belirli bir süreye kadar iptal edebilirler.

### 3. Edge Functions
Uygulama iş mantığı güvenliği ve ölçeklenebilirliği adına kritik süreçler Supabase Edge Functions üzerinde Deno runtime'ında koşar:
- **`book-appointment`**: Müsaitlik (availability) server-side olarak `get_occupied_ranges` RPC'si üzerinden kontrol edilir ve race-condition'ların önüne geçilir. `customer_notes` desteği mevcuttur.
- **`get-availability`**: Seçili personelin programı ve dükkan çalışma saatlerini birleştirerek uygun boş slotları döner.
- **`customer-cancel-appointment`**: Müşterinin önceden belirlenmiş iptal kurallarına (örn: randevuya en az 2 saat kala) uyarak randevusunu iptal etmesini sağlayan endpoint.

## 🛠 Tech Stack
- **Frontend**: Next.js (Web), Expo / React Native (Mobil)
- **Backend / Database**: Supabase (PostgreSQL), Edge Functions (Deno)
- **Paket Yöneticisi**: pnpm (Turborepo)

## 🚀 Komutlar
Uygulamanın durumunu doğrulamak için:
```bash
pnpm turbo type-check
```
