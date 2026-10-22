import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Box, Button, H2, H3, P, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';

// Ders projesi kapsamında hazırlanmış TASLAK aydınlatma metni.
// Gerçek yayından önce bir hukukçuya kontrol ettirilmelidir.

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Veri sorumlusu',
    body: [
      'Uğrak, bir üniversite ders projesi olarak geliştirilmektedir. Bu metin kapsamındaki kişisel veriler proje ekibi tarafından, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) çerçevesinde işlenir.',
    ],
  },
  {
    title: '2. İşlenen kişisel veriler',
    body: [
      'Kimlik/iletişim: okul e-posta adresi, kullanıcının seçtiği takma ad.',
      'Eğitim: e-posta alan adından belirlenen üniversite ve öğrencilik doğrulama tarihi.',
      'Kullanıcı içeriği: mekanlara verilen puanlar, yorumlar, favoriler, pixel avatar tercihleri.',
      'İşlem güvenliği: şifrenin geri döndürülemez özeti (hash), oturum bilgileri, giriş zamanları.',
      'Kampanya kullanımı: alınan kampanya kodları, oluşturulma ve kullanım zamanı.',
      'Uğrak; kimlik numarası, öğrenci belgesi, konum ya da özel nitelikli kişisel veri toplamaz.',
    ],
  },
  {
    title: '3. İşleme amaçları',
    body: [
      'Hesabın oluşturulması ve kişinin aktif öğrenci olduğunun okul e-postası ile doğrulanması,',
      'yılda bir yeniden doğrulama yapılması,',
      'öğrenci puan ve yorumlarının yayınlanması,',
      'öğrencilere özel kampanyaların tek kullanımlık kodlarla sunulması ve kötüye kullanımın önlenmesi,',
      'bilgi güvenliğinin sağlanması.',
    ],
  },
  {
    title: '4. Hukuki sebepler',
    body: [
      'KVKK m.5/2-(c): bir sözleşmenin kurulması veya ifası için gerekli olması (üyelik ve hizmetin sunulması).',
      'KVKK m.5/2-(f): meşru menfaat (sahte yorum ve kampanya suistimalinin önlenmesi, güvenlik kayıtları).',
      'KVKK m.5/2-(e): bir hakkın tesisi, kullanılması veya korunması (uyuşmazlık durumunda kayıtlar).',
    ],
  },
  {
    title: '5. Aktarım',
    body: [
      'Veriler uygulamanın barındırma ve veritabanı altyapısını sağlayan hizmet sağlayıcıda (Supabase) saklanır. Sunucunun yurt dışında bulunması hâlinde aktarım KVKK m.9’daki şartlara uygun olarak yapılır.',
      'Yorumlarda yalnızca takma ad, avatar ve üniversite kısaltması görünür; e-posta adresi başka kullanıcılarla ya da mekanlarla paylaşılmaz.',
      'Mekanlar, kendi kampanyalarına ait kodların kullanılıp kullanılmadığını görür; öğrencinin kimliğini görmez.',
    ],
  },
  {
    title: '6. Saklama süresi',
    body: [
      'Hesap verileri hesap açık kaldığı sürece saklanır. Hesap silindiğinde profil, yorum ve favoriler silinir; güvenlik kayıtları ve kampanya kullanım kayıtları en fazla 2 yıl saklandıktan sonra silinir veya anonim hâle getirilir.',
      'Yeniden doğrulaması yapılmayan hesaplar görüntüleme moduna geçer; 2 yıl boyunca hiç giriş yapılmayan hesaplar silinir.',
    ],
  },
  {
    title: '7. Haklarınız (KVKK m.11)',
    body: [
      'Kişisel verinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini, silinmesini veya yok edilmesini isteme, otomatik analiz sonucu aleyhinize bir sonuca itiraz etme ve zarara uğramanız hâlinde tazminat talep etme haklarına sahipsiniz.',
      'Başvurular uygulama içindeki hesap ayarları ya da proje e-posta adresi üzerinden yapılabilir ve en geç 30 gün içinde yanıtlanır.',
    ],
  },
];

export default function Kvkk() {
  const router = useRouter();
  return (
    <Screen>
      <Button
        small
        variant="secondary"
        title="← Geri"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/giris'))}
        style={{ alignSelf: 'flex-start', marginBottom: 12 }}
      />
      <H2>KVKK Aydınlatma Metni</H2>
      <Small style={{ marginBottom: 12 }}>Sürüm 1.0 · Ders projesi taslağı</Small>
      <Banner kind="warn" text="Bu metin ders projesi için hazırlanmış bir taslaktır; gerçek yayından önce hukuki kontrolden geçmelidir." />
      <Box bg={colors.paper}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={{ marginBottom: 14 }}>
            <H3 style={{ fontSize: 16, marginBottom: 6 }}>{s.title}</H3>
            {s.body.map((b, i) => (
              <P key={i} style={{ fontSize: 14, marginBottom: 4 }}>
                {s.body.length > 1 ? '• ' : ''}
                {b}
              </P>
            ))}
          </View>
        ))}
      </Box>
    </Screen>
  );
}
