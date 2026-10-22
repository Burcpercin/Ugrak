import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Kpi, PanelShell, SectionTitle, Table, V2Note } from '@/components/PanelShell';
import { Badge, Banner, Box, Button, Field, H2, P, Row, Small } from '@/components/ui';
import { UNIVERSITIES } from '@/lib/universities';
import { colors, fonts } from '@/theme';

// =====================================================================
// ADMİN PANELİ — TASLAK
// Uğrak ekibinin kullanacağı panel. Mekan sahipleri ekiple iletişime
// geçer → başvuru kaydı → görüşme → onay → ekip mekan hesabını açar.
// V1'de veriler örnektir (mock). V2'de venue_applications, venues ve
// universities tablolarına bağlanacak.
// =====================================================================

const NAV = [
  { key: 'basvuru', label: 'Mekan başvuruları' },
  { key: 'mekan', label: 'Mekanlar' },
  { key: 'uni', label: 'Üniversiteler' },
  { key: 'sikayet', label: 'Şikayetler' },
];

type Status = 'beklemede' | 'gorusuldu' | 'onaylandi' | 'reddedildi';
type App = { id: string; venue: string; contact: string; phone: string; district: string; date: string; status: Status };

const STATUS: Record<Status, { label: string; bg: string }> = {
  beklemede: { label: 'BEKLEMEDE', bg: colors.yellow },
  gorusuldu: { label: 'GÖRÜŞÜLDÜ', bg: colors.blueSoft },
  onaylandi: { label: 'ONAYLANDI', bg: colors.greenSoft },
  reddedildi: { label: 'REDDEDİLDİ', bg: colors.redSoft },
};

const INITIAL_APPS: App[] = [
  { id: 'a1', venue: 'Köşe Kahve Tepekent', contact: 'Ahmet Y.', phone: '0532 *** ** 12', district: 'Büyükçekmece', date: '20.10.2026', status: 'beklemede' },
  { id: 'a2', venue: 'Lezzet Durağı', contact: 'Ayşe K.', phone: '0541 *** ** 87', district: 'Esenler', date: '18.10.2026', status: 'gorusuldu' },
  { id: 'a3', venue: 'Kitaplı Bahçe', contact: 'Murat D.', phone: '0505 *** ** 40', district: 'Sarıyer', date: '15.10.2026', status: 'onaylandi' },
  { id: 'a4', venue: 'Gece Büfe', contact: 'Can T.', phone: '0553 *** ** 05', district: 'Beşiktaş', date: '11.10.2026', status: 'reddedildi' },
];

const VENUES = [
  { name: 'Tepe Çay Ocağı', uni: 'Arel', owner: 'Hesap açık', score: '4.3', campaigns: 2 },
  { name: 'Kampüs Dürüm', uni: 'Arel', owner: 'Hesap açık', score: '3.3', campaigns: 1 },
  { name: 'Ayazağa Kitap Kafe', uni: 'İTÜ', owner: 'Hesap açık', score: '4.0', campaigns: 1 },
  { name: 'Davutpaşa Pide', uni: 'YTÜ', owner: 'Hesap bekliyor', score: '3.5', campaigns: 1 },
  { name: 'Bebek Tatlıcısı', uni: 'Boğaziçi', owner: 'Hesapsız', score: '3.3', campaigns: 0 },
];

export default function AdminPaneli() {
  const [tab, setTab] = useState('basvuru');
  return (
    <PanelShell title={NAV.find((n) => n.key === tab)!.label} roleLabel="Admin paneli · Uğrak ekibi" nav={NAV} active={tab} onNav={setTab}>
      {tab === 'basvuru' && <Basvurular />}
      {tab === 'mekan' && <Mekanlar />}
      {tab === 'uni' && <Universiteler />}
      {tab === 'sikayet' && <Sikayetler />}
    </PanelShell>
  );
}

function Basvurular() {
  const [apps, setApps] = useState(INITIAL_APPS);
  const [createFor, setCreateFor] = useState<App | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = (id: string, status: Status) => setApps((l) => l.map((a) => (a.id === id ? { ...a, status } : a)));

  return (
    <>
      <Row style={{ flexWrap: 'wrap', gap: 12 }}>
        <Kpi label="Bekleyen başvuru" value={String(apps.filter((a) => a.status === 'beklemede').length)} bg={colors.orangeSoft} />
        <Kpi label="Aktif mekan" value="12" />
        <Kpi label="Doğrulanmış öğrenci" value="1.248" note="örnek değer" bg={colors.greenSoft} />
        <Kpi label="Bu hafta yorum" value="86" />
      </Row>

      <Box bg={colors.paper} style={{ marginBottom: 12 }}>
        <Text style={{ fontFamily: fonts.pixel, fontSize: 15, color: colors.ink, marginBottom: 6 }}>Mekan katılım süreci</Text>
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          {['1 · Mekan bizimle iletişime geçer', '2 · Başvuru kaydı', '3 · Görüşme', '4 · Onay', '5 · Ekip hesap açar', '6 · Mekan kampanya girer'].map((s) => (
            <Badge key={s} text={s} bg={colors.card} />
          ))}
        </Row>
      </Box>

      {done ? <Banner kind="ok" text={done} /> : null}

      <Table
        columns={[
          { key: 'venue', label: 'Mekan', width: 190 },
          { key: 'contact', label: 'Yetkili', width: 120 },
          { key: 'phone', label: 'Telefon', width: 140 },
          { key: 'district', label: 'Semt', width: 140 },
          { key: 'date', label: 'Tarih', width: 110 },
          { key: 'status', label: 'Durum', width: 130 },
          { key: 'action', label: 'İşlem', width: 260 },
        ]}
        rows={apps.map((a) => ({
          venue: a.venue,
          contact: a.contact,
          phone: a.phone,
          district: a.district,
          date: a.date,
          status: <Badge text={STATUS[a.status].label} bg={STATUS[a.status].bg} />,
          action: (
            <Row style={{ gap: 12 }}>
              {a.status === 'beklemede' ? <Link onPress={() => set(a.id, 'gorusuldu')}>Görüşüldü</Link> : null}
              {a.status === 'gorusuldu' ? (
                <>
                  <Link onPress={() => setCreateFor(a)}>Onayla + hesap aç</Link>
                  <Link color={colors.red} onPress={() => set(a.id, 'reddedildi')}>
                    Reddet
                  </Link>
                </>
              ) : null}
              {a.status === 'onaylandi' || a.status === 'reddedildi' ? <Small>—</Small> : null}
            </Row>
          ),
        }))}
      />
      <V2Note text="Mekanların kendisinin doldurabileceği başvuru formu (venue_applications tablosu hazır)" />

      <CreateVenueModal
        app={createFor}
        onClose={() => setCreateFor(null)}
        onDone={(email) => {
          if (createFor) set(createFor.id, 'onaylandi');
          setDone(`${createFor?.venue} için mekan hesabı oluşturuldu. Giriş linki ${email} adresine gönderilecek (taslak).`);
          setCreateFor(null);
        }}
      />
    </>
  );
}

function CreateVenueModal({ app, onClose, onDone }: { app: App | null; onClose: () => void; onDone: (email: string) => void }) {
  const [email, setEmail] = useState('');
  return (
    <Modal visible={!!app} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(27,27,27,0.55)', justifyContent: 'center', padding: 20 }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
          <Box bg={colors.paper}>
            <H2>Mekan hesabı oluştur</H2>
            <Small style={{ marginBottom: 12 }}>{app?.venue}</Small>
            <Field label="Mekan adı" value={app?.venue ?? ''} editable={false} />
            <Field label="Yetkili e-postası" placeholder="mekan@ornek.com" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Field label="Yakın kampüs" value="İstanbul Arel Üniversitesi" editable={false} />
            <P style={{ fontSize: 13, marginBottom: 12 }}>
              Hesap "venue_owner" rolüyle açılır ve sadece kendi mekanının kampanyalarını yönetebilir (RLS).
            </P>
            <Row style={{ gap: 10 }}>
              <Button title="OLUŞTUR" variant="success" onPress={() => onDone(email || 'yetkili e-posta')} />
              <Button title="Vazgeç" variant="secondary" small onPress={onClose} />
            </Row>
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Mekanlar() {
  return (
    <>
      <Table
        columns={[
          { key: 'name', label: 'Mekan', width: 210 },
          { key: 'uni', label: 'Kampüs', width: 120 },
          { key: 'owner', label: 'Mekan hesabı', width: 160 },
          { key: 'score', label: 'Puan', width: 80 },
          { key: 'campaigns', label: 'Aktif kampanya', width: 140 },
        ]}
        rows={VENUES.map((v) => ({ ...v, campaigns: String(v.campaigns) }))}
      />
      <V2Note text="Mekan verisinin Google Places üzerinden çekilmesi (lisans koşulları incelenecek)" />
    </>
  );
}

function Universiteler() {
  return (
    <>
      <Banner
        kind="warn"
        title="Personel / öğrenci ayrımı"
        text="Bazı üniversiteler öğrencilere ayrı alt alan adı verir (ör. ogr., std.). Kontrol edilen üniversitelerde sadece öğrenci alt alan adı kabul edilir ve 'Doğrulandı' işaretlenir."
      />
      <Table
        columns={[
          { key: 'name', label: 'Üniversite', width: 250 },
          { key: 'domains', label: 'Kabul edilen alan adları', width: 250 },
          { key: 'campus', label: 'Kampüs', width: 180 },
          { key: 'check', label: 'Öğrenci formatı', width: 160 },
        ]}
        rows={UNIVERSITIES.map((u) => ({
          name: u.name,
          domains: u.domains.join(', '),
          campus: u.campus_name,
          check: <Badge text="KONTROL EDİLECEK" bg={colors.yellow} />,
        }))}
      />
    </>
  );
}

function Sikayetler() {
  return (
    <Box bg={colors.paper} style={{ maxWidth: 620 }}>
      <P>Uygunsuz yorum, sahte yorum ve kampanya suistimali şikayetleri burada listelenecek.</P>
      <V2Note text="Şikayet et butonu, moderasyon kuyruğu, yorum gizleme" />
    </Box>
  );
}

function Link({ children, onPress, color = colors.blue }: { children: React.ReactNode; onPress: () => void; color?: string }) {
  return (
    <Text onPress={onPress} style={{ color, fontWeight: '700', fontSize: 13 }}>
      {children}
    </Text>
  );
}
