import type { AvatarConfig, Campaign, Venue } from './types';

// supabase/schema.sql'deki örnek verinin aynısı (demo modunda kullanılır).
// Mekan adları temsilidir.

export const SEED_VENUES: Venue[] = [
  { id: '00000000-0000-4000-8000-000000000101', name: 'Tepe Çay Ocağı', category: 'kafe', description: 'Bol prizli, sessiz köşeli çay ocağı. Sınav haftası favorisi.', district: 'Büyükçekmece', address: 'Tepekent Mah.', lat: 41.0641, lng: 28.5952, price_level: 1, university_id: 1 },
  { id: '00000000-0000-4000-8000-000000000102', name: 'Kampüs Dürüm', category: 'fastfood', description: 'Ders arası hızlı dürüm, öğrenci menüsü var.', district: 'Büyükçekmece', address: 'Tepekent Mah.', lat: 41.0612, lng: 28.5911, price_level: 1, university_id: 1 },
  { id: '00000000-0000-4000-8000-000000000103', name: 'Göl Kenarı Kahve', category: 'kafe', description: 'Göl manzaralı, hafta sonu kalabalık.', district: 'Büyükçekmece', address: 'Sahil Yolu', lat: 41.0218, lng: 28.5807, price_level: 2, university_id: 1 },
  { id: '00000000-0000-4000-8000-000000000104', name: 'Ev Yemekleri Lokantası', category: 'restoran', description: 'Günlük değişen tencere yemekleri, porsiyonlar büyük.', district: 'Büyükçekmece', address: 'Mimarsinan Mah.', lat: 41.0533, lng: 28.6012, price_level: 1, university_id: 1 },
  { id: '00000000-0000-4000-8000-000000000201', name: 'Ayazağa Kitap Kafe', category: 'kutuphane-kafe', description: 'Kitap okuma köşeleri, hızlı wifi, uzun masa.', district: 'Sarıyer', address: 'Ayazağa Mah.', lat: 41.1072, lng: 29.0221, price_level: 2, university_id: 2 },
  { id: '00000000-0000-4000-8000-000000000202', name: 'Maslak Burger Durağı', category: 'fastfood', description: 'Öğrenci kartına menü indirimi.', district: 'Sarıyer', address: 'Maslak', lat: 41.1101, lng: 29.0198, price_level: 2, university_id: 2 },
  { id: '00000000-0000-4000-8000-000000000301', name: 'Hisar Simit Evi', category: 'kafe', description: 'Sabah simit-çay, bahçede ders çalışılabilir.', district: 'Beşiktaş', address: 'Rumelihisarı', lat: 41.0851, lng: 29.0563, price_level: 1, university_id: 3 },
  { id: '00000000-0000-4000-8000-000000000302', name: 'Bebek Tatlıcısı', category: 'tatli', description: 'Sütlü tatlılar, akşamları kalabalık.', district: 'Beşiktaş', address: 'Bebek', lat: 41.0773, lng: 29.0434, price_level: 3, university_id: 3 },
  { id: '00000000-0000-4000-8000-000000000401', name: 'Davutpaşa Pide', category: 'restoran', description: 'Uygun fiyatlı pide ve lahmacun.', district: 'Esenler', address: 'Davutpaşa Cad.', lat: 41.0277, lng: 28.8868, price_level: 1, university_id: 4 },
  { id: '00000000-0000-4000-8000-000000000402', name: 'Etüt Kahve', category: 'kutuphane-kafe', description: 'Sessiz kat, saatlik masa yok, priz bol.', district: 'Esenler', address: 'Davutpaşa Kampüs Karşısı', lat: 41.0239, lng: 28.8921, price_level: 2, university_id: 4 },
  { id: '00000000-0000-4000-8000-000000000601', name: 'Beyazıt Börekçisi', category: 'kafe', description: 'Sabahları taze börek, ayakta hızlı servis.', district: 'Fatih', address: 'Beyazıt Meydanı', lat: 41.0107, lng: 28.9645, price_level: 1, university_id: 6 },
  { id: '00000000-0000-4000-8000-000000000701', name: 'Sahil Döner', category: 'fastfood', description: 'Kampüse 3 dakika, gece geç saate kadar açık.', district: 'Beşiktaş', address: 'Çırağan Cad.', lat: 41.0431, lng: 29.011, price_level: 2, university_id: 7 },
];

const day = 24 * 3600 * 1000;
const start = () => new Date(Date.now() - day).toISOString();
const end = () => new Date(Date.now() + 60 * day).toISOString();

export const seedCampaigns = (): Campaign[] => [
  { id: '00000000-0000-4000-8000-000000001001', venue_id: '00000000-0000-4000-8000-000000000101', title: 'Sınav Haftası Çayı', description: 'Öğrenci kimliğiyle sınırsız çay 2 saat.', discount_text: 'Sınırsız çay 30₺', starts_at: start(), ends_at: end(), is_active: true },
  { id: '00000000-0000-4000-8000-000000001002', venue_id: '00000000-0000-4000-8000-000000000102', title: 'Öğle Menüsü', description: 'Dürüm + ayran öğle saatlerinde.', discount_text: '%20 indirim', starts_at: start(), ends_at: end(), is_active: true },
  { id: '00000000-0000-4000-8000-000000001003', venue_id: '00000000-0000-4000-8000-000000000201', title: 'Filtre Kahve', description: 'Her filtre kahvede ikinci bardak bedava.', discount_text: '1 alana 1 bedava', starts_at: start(), ends_at: end(), is_active: true },
  { id: '00000000-0000-4000-8000-000000001004', venue_id: '00000000-0000-4000-8000-000000000401', title: 'Pide + Ayran', description: 'Öğrenci menüsü.', discount_text: '%15 indirim', starts_at: start(), ends_at: end(), is_active: true },
  { id: '00000000-0000-4000-8000-000000001005', venue_id: '00000000-0000-4000-8000-000000000701', title: 'Gece Menüsü', description: '22:00 sonrası öğrenciye özel.', discount_text: '%25 indirim', starts_at: start(), ends_at: end(), is_active: true },
];

// Demo modunda listeler boş görünmesin diye örnek öğrenciler ve yorumlar.
type DemoAuthor = { id: string; display_name: string; university_id: number; avatar: AvatarConfig };

export const DEMO_AUTHORS: DemoAuthor[] = [
  { id: 'demo-u1', display_name: 'Ece', university_id: 1, avatar: { skin: 0, hairStyle: 'uzun', hairColor: 1, shirt: 1, glasses: false } },
  { id: 'demo-u2', display_name: 'Kaan', university_id: 1, avatar: { skin: 2, hairStyle: 'kisa', hairColor: 0, shirt: 0, glasses: true } },
  { id: 'demo-u3', display_name: 'Zeynep', university_id: 2, avatar: { skin: 1, hairStyle: 'bere', hairColor: 2, shirt: 3, glasses: false } },
  { id: 'demo-u4', display_name: 'Mert', university_id: 4, avatar: { skin: 3, hairStyle: 'kisa', hairColor: 0, shirt: 2, glasses: false } },
  { id: 'demo-u5', display_name: 'Defne', university_id: 3, avatar: { skin: 0, hairStyle: 'uzun', hairColor: 3, shirt: 4, glasses: true } },
];

type SeedReview = {
  user_id: string;
  venue_id: string;
  price: number;
  study: number;
  portion: number;
  vibe: number;
  comment: string;
  daysAgo: number;
};

export const SEED_REVIEWS: SeedReview[] = [
  { user_id: 'demo-u1', venue_id: '00000000-0000-4000-8000-000000000101', price: 5, study: 5, portion: 3, vibe: 4, comment: 'Arka masada priz var, finallerde buradaydım. Çay ucuz.', daysAgo: 3 },
  { user_id: 'demo-u2', venue_id: '00000000-0000-4000-8000-000000000101', price: 5, study: 4, portion: 3, vibe: 3, comment: 'Wifi bazen kopuyor ama fiyat iyi.', daysAgo: 9 },
  { user_id: 'demo-u2', venue_id: '00000000-0000-4000-8000-000000000102', price: 4, study: 1, portion: 5, vibe: 3, comment: 'Ders çalışılacak yer değil ama dürüm doyurucu.', daysAgo: 5 },
  { user_id: 'demo-u1', venue_id: '00000000-0000-4000-8000-000000000104', price: 5, study: 2, portion: 5, vibe: 3, comment: 'Ev yemeği arayan için birebir, kuru fasulye efsane.', daysAgo: 12 },
  { user_id: 'demo-u1', venue_id: '00000000-0000-4000-8000-000000000103', price: 2, study: 3, portion: 3, vibe: 5, comment: 'Manzara güzel, biraz pahalı.', daysAgo: 20 },
  { user_id: 'demo-u3', venue_id: '00000000-0000-4000-8000-000000000201', price: 3, study: 5, portion: 3, vibe: 5, comment: 'Uzun masa ve sessizlik, tam çalışmalık.', daysAgo: 2 },
  { user_id: 'demo-u3', venue_id: '00000000-0000-4000-8000-000000000202', price: 3, study: 2, portion: 4, vibe: 4, comment: 'Öğrenci menüsü mantıklı.', daysAgo: 6 },
  { user_id: 'demo-u5', venue_id: '00000000-0000-4000-8000-000000000301', price: 5, study: 4, portion: 3, vibe: 4, comment: 'Bahçesi sabahları çok güzel.', daysAgo: 4 },
  { user_id: 'demo-u5', venue_id: '00000000-0000-4000-8000-000000000302', price: 2, study: 2, portion: 4, vibe: 5, comment: 'Tatlılar güzel ama öğrenci bütçesine ağır.', daysAgo: 15 },
  { user_id: 'demo-u4', venue_id: '00000000-0000-4000-8000-000000000401', price: 5, study: 1, portion: 5, vibe: 3, comment: 'Ucuz ve doyurucu.', daysAgo: 7 },
  { user_id: 'demo-u4', venue_id: '00000000-0000-4000-8000-000000000402', price: 3, study: 5, portion: 2, vibe: 4, comment: 'Sınav haftası yer bulmak zor, erken git.', daysAgo: 1 },
];
