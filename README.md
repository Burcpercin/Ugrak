<<<<<<< HEAD
# Ugrak
=======
# Uğrak — V1

İstanbul’daki üniversite öğrencilerinin mekanları öğrenciye özel 4 kriterle (fiyat, ders çalışmaya uygunluk, porsiyon, ortam) puanladığı ve mekanların öğrencilere özel kampanya sunduğu uygulama.

- **Teknoloji:** Expo (React Native) + Expo Router · Supabase (PostgreSQL, Auth, RLS)
- **Platform:** Aynı kod web, Android ve iOS’ta çalışır. V1 web olarak yayınlanır.
- **Ders projesi** · 2 kişilik ekip

## V1’de neler var

| Özellik | Durum |
|---|---|
| Okul e-postası (.edu.tr) ile kayıt, alan adından üniversite tespiti, sadece İstanbul | ✅ Çalışıyor |
| Doğrulama maili → linke tıklayınca öğrenci statüsü | ✅ Çalışıyor |
| Yıllık yeniden doğrulama (okul adresine 6 haneli kod) | ✅ Çalışıyor |
| E-posta + şifre ile giriş | ✅ Çalışıyor |
| KVKK aydınlatma metni ve kayıtta onay | ✅ Çalışıyor |
| Basit pixel avatar oluşturucu | ✅ Çalışıyor |
| Mekan listesi: kampüse göre, arama, kategori, sıralama, mesafe | ✅ Çalışıyor |
| Mekan detayı, 4 kriterli puan + yorum (mekan başına tek yorum, düzenle/sil) | ✅ Çalışıyor |
| Kampanya kodu: QR + 6 haneli kod, 10 dk geçerli, tek kullanımlık | ✅ Çalışıyor |
| Favoriler, profil, yorumlarım | ✅ Çalışıyor |
| Mekan paneli (`/panel`) | 🟡 Taslak, örnek veri |
| Admin paneli (`/admin`) | 🟡 Taslak, örnek veri |
| Harita, forum, bildirim, misafir/mezun rolleri | ⏭ Sonraki sürümler |

## Çalıştırma

Gerekenler: Node.js 20+ ve VS Code.

```bash
npm install
npm run web          # tarayıcıda açar (http://localhost:8081)
```

Telefonda denemek için: telefona **Expo Go** uygulamasını kur, `npx expo start` yaz ve çıkan QR’ı okut.

Web için yayın dosyası üretmek: `npm run build:web` → `dist/` klasörü (Netlify/Vercel’e sürüklenip yayınlanabilir; SPA olduğu için tüm yollar `index.html`’e yönlenmeli).
Tek dosyalık demo sayfası üretmek için: `python3 scripts/tek-dosya-web.py dist demo.html` (JS ve fontlar HTML’in içine gömülür).

## İki çalışma modu

| | Demo modu | Supabase modu |
|---|---|---|
| Ne zaman | `.env` boşsa | `.env`’de Supabase bilgileri varsa |
| Veri | Tarayıcıda (localStorage) | PostgreSQL (Supabase) |
| Doğrulama maili | Uygulama içinde **Demo gelen kutusu** | Öğrencinin gerçek okul adresine gider |
| Kurallar | Aynı | Aynı + veritabanında RLS ile zorunlu |

Ekranlar hangi modda çalıştığını bilmez; ikisi de `src/lib/types.ts` içindeki `Api` arayüzünü uygular.

Demo modunda **Profil → Sunum araçları** ile doğrulama tarihi 1 yıl geriye alınabilir; uygulama yıllık doğrulama ekranına geçer. Aynı yerden demo verileri sıfırlanır.

## Supabase kurulumu (gerçek mail için, ~10 dk)

1. https://supabase.com → **New project** (bölge: Central EU / Frankfurt).
2. **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**.
   Tablolar, RLS kuralları, edu kontrol tetikleyicisi, fonksiyonlar ve örnek veri kurulur.
3. **Authentication → Sign In / Providers → Email**: *Confirm email* açık olmalı.
4. **Authentication → URL Configuration**: *Site URL* olarak uygulamanın adresini yaz (yerelde `http://localhost:8081`).
5. **Authentication → Emails (Templates)**:
   - *Confirm signup* şablonunu Türkçeleştirebilirsiniz.
   - *Magic Link* şablonuna **`{{ .Token }}`** ekleyin. Yıllık doğrulama 6 haneli kodu bu şablonla gönderir.
6. **Project Settings → API**: Project URL ve publishable (anon) key’i kopyala.
7. Proje klasöründe `.env.example` dosyasını `.env` olarak kopyala, iki değeri yapıştır, `npm run web` ile yeniden başlat.
8. İsteğe bağlı: Supabase’in ücretsiz mail servisi saatte birkaç mail ile sınırlıdır. Sunumda sorun olmaması için *Authentication → Emails → SMTP* kısmından kendi SMTP’nizi bağlayabilirsiniz (ör. Resend, Brevo).

Admin yapmak için: `update public.profiles set role = 'admin' where email = '...';`

## Klasör yapısı

```
src/
  app/                    Ekranlar (Expo Router: her dosya bir sayfa)
    giris.tsx  kayit.tsx  dogrulama.tsx  avatar.tsx  kvkk.tsx
    (tabs)/kesfet.tsx  kampanyalar.tsx  profil.tsx
    mekan/[id].tsx
    panel/index.tsx       Mekan paneli (taslak)
    admin/index.tsx       Admin paneli (taslak)
  components/             Ortak bileşenler (UI, Avatar, QR, kampanya kodu, yorum formu)
  lib/
    api/demo.ts           Demo modu veri katmanı
    api/supabase.ts       Supabase veri katmanı
    auth.tsx              Oturum + profil + doğrulama süresi
    universities.ts       İstanbul üniversiteleri ve e-posta kontrolü
    seed.ts               Örnek mekan/kampanya/yorum verisi
supabase/schema.sql       Veritabanı: tablolar, RLS, tetikleyiciler, fonksiyonlar, örnek veri
docs/                     Gereksinim analizi
```

## Güvenlik notları

- Edu alan adı kontrolü hem uygulamada hem veritabanı tetikleyicisinde yapılır (API doğrudan çağrılsa bile geçemez).
- Yorum yazma, kampanya kodu alma RLS ve fonksiyonlarda **doğrulaması son 1 yıl içinde olan** kullanıcıya açıktır.
- Kullanıcı profilinde sadece takma ad ve avatar değiştirilebilir (sütun düzeyi yetki); rol ve doğrulama tarihi değiştirilemez.
- Yorumlarda sadece takma ad, avatar ve üniversite kısaltması görünür; e-posta dışarı çıkmaz (`review_feed` görünümü).
- Bilinen kısıt: personel e-postaları da `.edu.tr` olduğundan, öğrenci alt alan adı kullanmayan üniversitelerde personel ayırt edilemez. Bkz. gereksinim analizi, Riskler.
>>>>>>> f2eaa45 (V1: Expo uygulaması kurulumu, Supabase şeması, gereksinim analizi)
