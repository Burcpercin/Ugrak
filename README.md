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
| Yıllık yeniden doğrulama (okul adresine link + kod) | ✅ Çalışıyor |
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

### Mobil (Android / iOS)

Aynı kod telefonda da çalışır. Telefonda alt sekme çubuğu, web’de üst menü görünür.

| Yöntem | Komut | Not |
|---|---|---|
| Android emülatörü | `npm run android` | Android Studio’da bir sanal cihaz (AVD) açık olmalı |
| Gerçek telefon | `npx expo start` → QR’ı **Expo Go** ile okut | Telefon ve bilgisayar aynı Wi-Fi’da |
| Yüklenebilir APK | `npx eas-cli@latest build -p android --profile preview` | Expo hesabı gerekir, derleme bulutta yapılır |

Uygulama kimliği: `com.ugrak.app` (app.json). Adres şeması: `ugrak://`.

**Supabase ile telefonda doğrulama linki:** Supabase paneli → Authentication → URL Configuration → **Redirect URLs** listesine şunları ekle:

- `ugrak://**` (yüklenmiş uygulama / APK)
- `exp://**` (Expo Go ile geliştirirken)
- web adresin, ör. `http://localhost:8081/**`

Link telefonda açılınca uygulama açılır ve oturum otomatik kurulur. Link başka cihazda açılsa bile e-posta doğrulanır; kullanıcı uygulamada **Giriş yap** ile devam eder.

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

Demo modunda giriş ekranında hazır hesaplar var (şifre `ugrak1234`):
**Mekan sahibi olarak gir** (`mekan@tepecay.com`, Tepe Çay Ocağı) ve **Admin olarak gir** (`admin@istanbularel.edu.tr`).
Admin bir başvuruyu onaylayınca sahibine giden "şifreni belirle" maili demo gelen kutusunda görünür.

## Supabase kurulumu (gerçek mail için, ~10 dk)

1. https://supabase.com → **New project** (bölge: Central EU / Frankfurt).
2. **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**.
   Tablolar, RLS kuralları, edu kontrol tetikleyicisi, fonksiyonlar ve örnek veri kurulur.
   Ardından `supabase/` içindeki tarihli güncelleme dosyalarını **tarih sırasıyla** aynı şekilde çalıştır
   (`2026-11-03-arel-alan-adi.sql`, `2026-11-04-faz1-guvenlik-misafir-kampus.sql`,
   `2026-11-05-faz2-paneller.sql`). Güncellemeler iki kez çalıştırılsa da sorun çıkarmaz; ama sırayı bozma
   (eski bir dosyayı yenisinden sonra tek başına çalıştırırsan sonrakini yeniden çalıştır).
3. **Authentication → Sign In / Providers → Email**: *Confirm email* açık olmalı.
4. **Authentication → URL Configuration**: *Site URL* olarak uygulamanın adresini yaz (yerelde `http://localhost:8081`).
   Mekan sahibine giden "şifreni belirle" linki bu adrese döner. Uygulama internette yayınlanınca Site URL'i o adresle
   değiştir; yoksa sahip linki kendi cihazında açamaz.
5. **Authentication → Emails (Templates)**:
   - *Confirm signup* ← `supabase/email-templates/1-kayit-onayi.html`
   - *Magic Link* ← `supabase/email-templates/2-yillik-dogrulama.html` (yıllık doğrulama: link + kod)
   - *Reset Password* ← `supabase/email-templates/3-sifre-belirle.html` (şifremi unuttum + mekan sahibinin ilk şifresi)
6. **Project Settings → API**: Project URL ve publishable (anon) key’i kopyala.
7. Proje klasöründe `.env.example` dosyasını `.env` olarak kopyala, iki değeri yapıştır, `npm run web` ile yeniden başlat.
8. İsteğe bağlı: Supabase’in ücretsiz mail servisi saatte birkaç mail ile sınırlıdır. Sunumda sorun olmaması için *Authentication → Emails → SMTP* kısmından kendi SMTP’nizi bağlayabilirsiniz (ör. Resend, Brevo).

Admin yapmak için: `update public.profiles set role = 'admin' where email = '...';`
(Admin, öğrenci hesabıyla kayıt olmuş bir ekip üyesidir. Uygulamadan kimse kendini admin yapamaz.)

### Sunucu fonksiyonları (Edge Functions) — mekan hesabı açma ve hesap silme

Mekan sahibi hesabı açmak ve hesap silmek, uygulamanın kendi anahtarıyla yapılamayan işlerdir; bunları
Supabase'in sunucusunda çalışan iki küçük fonksiyon yapar. Tam yetkili anahtar sadece orada durur.

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Adı **`admin-mekan`** → `supabase/functions/admin-mekan/index.ts` dosyasının tamamını yapıştır → **Deploy function**.
3. Aynısını **`hesap-sil`** adıyla `supabase/functions/hesap-sil/index.ts` için yap.
4. Ek ayar gerekmez: `SUPABASE_URL` ve anahtarları Supabase fonksiyona kendisi verir.

Kurulmazsa uygulama "Sunucu fonksiyonu kurulmamış" der; diğer her şey çalışır.

### Mekan sahibi akışı

1. Mekan, uygulamadaki **"Mekan sahibiyim, başvur"** formunu doldurur.
2. Admin, **Admin paneli → Başvurular**'da görüşür, **Onayla + mekanı aç** der; konumu Google Haritalar'dan yapıştırır.
3. Mekan açılır, sahibin e-postasına **"şifreni belirle"** maili gider (davet 15 dk içinde hesaba dönüşür;
   davetsiz hiç kimse .edu dışı adresle hesap açamaz).
4. Sahip linke dokunur, şifresini belirler ve **Mekan paneli**ne düşer: kod doğrulama (telefonda QR), kampanyalar,
   puanlar, yorumlar.

## Veritabanı erişim testi

```
npm run test:db
```

Bellekte gerçek bir PostgreSQL açar (internet ve Supabase gerekmez), şemayı ve güncellemeleri kurar,
sonra misafir, öğrenci, doğrulaması dolmuş öğrenci, mekan sahibi, admin ve sunucu fonksiyonu için 150 kuralı
tek tek dener (ör. misafir kod alamaz, öğrenci kendini admin yapamaz, mekan sahibi öğrencinin kimliğini göremez,
davetsiz .edu dışı adresle hesap açılamaz, 20 hatalı kod denemesinden sonra bekletilir).
`DETAY=1 npm run test:db` engellenen her işlemin sebebini de gösterir.
Veritabanında bir yetki değiştirildiğinde bu test yeniden çalıştırılmalı.

## Klasör yapısı

```
src/
  app/                    Ekranlar (Expo Router: her dosya bir sayfa)
    giris.tsx  kayit.tsx  dogrulama.tsx  avatar.tsx  kvkk.tsx
    (tabs)/kesfet.tsx  kampanyalar.tsx  profil.tsx
    mekan/[id].tsx
    panel/index.tsx       Mekan paneli (kod doğrulama, kampanyalar, özet, yorumlar)
    admin/index.tsx       Admin paneli (başvurular, mekanlar, yorum denetimi, kampüsler)
    mekan-basvuru.tsx     Mekan başvuru formu (giriş gerekmez)
    sifremi-unuttum.tsx  sifre.tsx  hesap-sil.tsx
  components/             Ortak bileşenler (UI, Avatar, QR, kampanya kodu, yorum formu)
  lib/
    api/demo.ts           Demo modu veri katmanı
    api/supabase.ts       Supabase veri katmanı
    auth.tsx              Oturum + profil + doğrulama süresi + misafir/öğrenci durumu
    location.tsx          Konum izni / kampüs seçimi (mesafe cihazda hesaplanır)
    guestStore.ts         Misafirin cihazdaki favorileri ve karakteri
    universities.ts       İstanbul üniversiteleri ve e-posta kontrolü
    seed.ts               Örnek mekan/kampanya/yorum verisi
supabase/schema.sql       Veritabanı: tablolar, RLS, tetikleyiciler, fonksiyonlar, örnek veri
supabase/2026-*.sql       Tarih sırasıyla çalıştırılacak güncellemeler
supabase/tests/           Veritabanı erişim testi (npm run test:db)
docs/                     Gereksinim analizi
```

## Güvenlik notları

- Edu alan adı kontrolü hem uygulamada hem veritabanı tetikleyicisinde yapılır (API doğrudan çağrılsa bile geçemez).
- Yorum yazma, kampanya kodu alma RLS ve fonksiyonlarda **doğrulaması son 1 yıl içinde olan** kullanıcıya açıktır.
- Kullanıcı profilinde sadece takma ad ve avatar değiştirilebilir (sütun düzeyi yetki); rol ve doğrulama tarihi değiştirilemez.
- Yorumlarda sadece takma ad, avatar ve üniversite kısaltması görünür; yazarın kimliği ve e-postası dışarı çıkmaz (`review_feed` görünümü, `is_mine` alanı).
- Misafir (giriş yapmamış) sadece aktif mekanları, kampanyaları, puan ortalamalarını ve yorumları okuyabilir; hiçbir veritabanı fonksiyonunu çalıştıramaz.
- Mekan sahibi kod kullanan öğrencinin kimliğini göremez (`venue_redemptions` görünümü); mekanların sahip bilgisi (`owner_id`) dışarı verilmez.
- Mekan başvurularında alan uzunluğu sınırı ve basit spam koruması var (aynı telefon/e-posta 24 saatte bir, saatte en çok 30 başvuru).
- Konum sunucuya gönderilmez; mesafe cihazda hesaplanır. Misafirin favorileri ve karakteri sadece cihazında durur.
- Mekan sahibi öğrenci sayılmaz: e-postası .edu olsa bile puan veremez, kampanya kodu alamaz.
- Kod doğrulama: başka mekanın kodu, kullanılmış/süresi dolmuş kod ve durdurulmuş kampanya ayrı ayrı reddedilir;
  bir mekan hesabı 10 dakikada 20 hatalı denemeden sonra bekletilir (kod tahminine karşı).
- Kampanyalar silinmez (öğrencilerin kod geçmişi kalır); en fazla 90 gün, aynı anda en fazla 3; başladıktan sonra
  başlık ve indirim değiştirilemez.
- Mekanlar silinmez, kapatılır. Mekan sahibini sadece sunucu fonksiyonu atar; admin bile `owner_id`'yi elle değiştiremez.
- Hesap silme (KVKK): şifre sunucuda tekrar kontrol edilir; mekan ve admin hesapları uygulamadan silinemez.
- Bilinen kısıt: personel e-postaları da `.edu.tr` olduğundan, öğrenci alt alan adı kullanmayan üniversitelerde personel ayırt edilemez. Bkz. gereksinim analizi, Riskler.
