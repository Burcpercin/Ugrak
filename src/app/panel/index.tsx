import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Kpi, PanelShell, SectionTitle, Table, V2Note } from '@/components/PanelShell';
import { Badge, Banner, Box, Button, Field, P, Row, ScoreBar, Small } from '@/components/ui';
import { CRITERIA, colors, fonts } from '@/theme';

// =====================================================================
// MEKAN PANELİ — TASLAK
// Mekan sahibinin kullanacağı web paneli. V1'de tüm veriler örnektir (mock).
// V2'de Supabase'e bağlanacak: campaigns tablosu, redeem_code() fonksiyonu
// ve venue_stats görünümü bu ekranların veri kaynağıdır.
// =====================================================================

const NAV = [
  { key: 'ozet', label: 'Özet' },
  { key: 'kampanya', label: 'Kampanyalar' },
  { key: 'kod', label: 'Kod doğrula' },
  { key: 'yorum', label: 'Yorumlar' },
  { key: 'bilgi', label: 'Mekan bilgileri' },
];

type MockCampaign = { id: string; title: string; discount: string; ends: string; used: number; active: boolean };

const INITIAL_CAMPAIGNS: MockCampaign[] = [
  { id: 'c1', title: 'Sınav Haftası Çayı', discount: 'Sınırsız çay 30₺', ends: '31.12.2026', used: 86, active: true },
  { id: 'c2', title: 'Sabah Simit + Çay', discount: '%20 indirim', ends: '15.11.2026', used: 42, active: true },
  { id: 'c3', title: 'Yaz Okulu Menüsü', discount: '%15 indirim', ends: '31.08.2026', used: 131, active: false },
];

const WEEK = [
  { d: 'Pzt', n: 14 },
  { d: 'Sal', n: 22 },
  { d: 'Çar', n: 19 },
  { d: 'Per', n: 27 },
  { d: 'Cum', n: 31 },
  { d: 'Cmt', n: 9 },
  { d: 'Paz', n: 6 },
];

const RECENT = [
  { code: 'K7MQ2X', campaign: 'Sınav Haftası Çayı', time: 'Bugün 14:32', ok: true },
  { code: 'P3ZT9A', campaign: 'Sabah Simit + Çay', time: 'Bugün 09:05', ok: true },
  { code: 'H8WR4N', campaign: 'Sınav Haftası Çayı', time: 'Dün 18:47', ok: true },
  { code: 'B2LC6E', campaign: 'Sınav Haftası Çayı', time: 'Dün 16:10', ok: false },
];

const MOCK_REVIEWS = [
  { name: 'Ece', uni: 'Arel', avg: 4.3, text: 'Arka masada priz var, finallerde buradaydım. Çay ucuz.', date: '19.10.2026' },
  { name: 'Kaan', uni: 'Arel', avg: 3.8, text: 'Wifi bazen kopuyor ama fiyat iyi.', date: '13.10.2026' },
  { name: 'Selin', uni: 'Arel', avg: 4.5, text: 'Sessiz köşe tam ders çalışmalık.', date: '02.10.2026' },
];

const VALID_CODES: Record<string, string> = { AB12CD: 'Sınav Haftası Çayı', XY34ZW: 'Sabah Simit + Çay' };

export default function MekanPaneli() {
  const [tab, setTab] = useState('ozet');
  return (
    <PanelShell title={NAV.find((n) => n.key === tab)!.label} roleLabel="Mekan paneli · Tepe Çay Ocağı" nav={NAV} active={tab} onNav={setTab}>
      {tab === 'ozet' && <Ozet />}
      {tab === 'kampanya' && <Kampanyalar />}
      {tab === 'kod' && <KodDogrula />}
      {tab === 'yorum' && <Yorumlar />}
      {tab === 'bilgi' && <Bilgiler />}
    </PanelShell>
  );
}

function Ozet() {
  const max = Math.max(...WEEK.map((w) => w.n));
  return (
    <>
      <Row style={{ flexWrap: 'wrap', gap: 12 }}>
        <Kpi label="Bu hafta kullanılan kod" value="128" note="geçen haftaya göre +18%" bg={colors.orangeSoft} />
        <Kpi label="Aktif kampanya" value="2" />
        <Kpi label="Öğrenci puanı" value="4.3" note="24 doğrulanmış yorum" bg={colors.greenSoft} />
        <Kpi label="Favoriye ekleyen" value="57" />
      </Row>

      <SectionTitle>Son 7 gün · kullanılan kampanya kodu</SectionTitle>
      <Box>
        <Row style={{ alignItems: 'flex-end', height: 170, gap: 10 }}>
          {WEEK.map((w) => (
            <View key={w.d} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 13, marginBottom: 4, color: colors.ink }}>{w.n}</Text>
              <View style={{ width: '70%', height: (w.n / max) * 120, backgroundColor: colors.blue, borderWidth: 3, borderColor: colors.ink }} />
              <Small style={{ marginTop: 6 }}>{w.d}</Small>
            </View>
          ))}
        </Row>
      </Box>

      <SectionTitle>Son kod kullanımları</SectionTitle>
      <Table
        columns={[
          { key: 'code', label: 'Kod', width: 120 },
          { key: 'campaign', label: 'Kampanya', width: 240 },
          { key: 'time', label: 'Zaman', width: 160 },
          { key: 'status', label: 'Durum', width: 160 },
        ]}
        rows={RECENT.map((r) => ({
          code: r.code,
          campaign: r.campaign,
          time: r.time,
          status: r.ok ? <Badge text="KULLANILDI" bg={colors.greenSoft} /> : <Badge text="SÜRESİ DOLDU" bg={colors.redSoft} />,
        }))}
      />
      <Small style={{ marginTop: 8 }}>Mekan, kodu kullanan öğrencinin kimliğini görmez; sadece kodun geçerliliğini görür (KVKK).</Small>
    </>
  );
}

function Kampanyalar() {
  const [list, setList] = useState(INITIAL_CAMPAIGNS);
  const [title, setTitle] = useState('');
  const [discount, setDiscount] = useState('');
  const [ends, setEnds] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <>
      <Table
        columns={[
          { key: 'title', label: 'Kampanya', width: 230 },
          { key: 'discount', label: 'İndirim', width: 170 },
          { key: 'ends', label: 'Bitiş', width: 120 },
          { key: 'used', label: 'Kullanım', width: 100 },
          { key: 'status', label: 'Durum', width: 170 },
        ]}
        rows={list.map((c) => ({
          title: c.title,
          discount: c.discount,
          ends: c.ends,
          used: String(c.used),
          status: (
            <Row style={{ gap: 8 }}>
              <Badge text={c.active ? 'AKTİF' : 'PASİF'} bg={c.active ? colors.greenSoft : colors.grey} />
              <Text
                onPress={() => setList((l) => l.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)))}
                style={{ color: colors.blue, fontWeight: '700', fontSize: 13 }}
              >
                {c.active ? 'Durdur' : 'Başlat'}
              </Text>
            </Row>
          ),
        }))}
      />

      <SectionTitle>Yeni kampanya</SectionTitle>
      <Box bg={colors.paper}>
        {msg ? <Banner kind="ok" text={msg} /> : null}
        <Row style={{ flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 220 }}>
            <Field label="Başlık" placeholder="ör. Final Haftası Kahvesi" value={title} onChangeText={setTitle} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 160 }}>
            <Field label="İndirim" placeholder="ör. %20 indirim" value={discount} onChangeText={setDiscount} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 140 }}>
            <Field label="Bitiş tarihi" placeholder="GG.AA.YYYY" value={ends} onChangeText={setEnds} />
          </View>
        </Row>
        <Button
          title="KAMPANYAYI YAYINLA"
          variant="accent"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => {
            if (!title.trim() || !discount.trim()) {
              setMsg(null);
              return;
            }
            setList((l) => [{ id: String(Date.now()), title, discount, ends: ends || '—', used: 0, active: true }, ...l]);
            setTitle('');
            setDiscount('');
            setEnds('');
            setMsg('Kampanya listeye eklendi (taslak — kaydedilmez).');
          }}
        />
        <V2Note text="Yayınlanan kampanya favoriye ekleyen öğrencilere bildirim olarak gidecek" />
      </Box>
    </>
  );
}

function KodDogrula() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <>
      <Box bg={colors.paper} style={{ maxWidth: 520 }}>
        <P style={{ marginBottom: 12 }}>
          Öğrencinin ekranındaki 6 haneli kodu gir. Kod tek kullanımlıktır ve 10 dakika geçerlidir. Kasada öğrenci kimlik
          kartını da kontrol et.
        </P>
        <Field
          label="Kampanya kodu"
          placeholder="AB12CD"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          style={{ fontWeight: '800', fontSize: 24, letterSpacing: 6 }}
        />
        <Button
          title="DOĞRULA"
          variant="success"
          onPress={() => {
            const c = VALID_CODES[code];
            setResult(
              c
                ? { ok: true, text: `Geçerli kod ✓ · ${c}. Kod kullanıldı olarak işaretlendi.` }
                : { ok: false, text: 'Kod bulunamadı, süresi dolmuş ya da daha önce kullanılmış.' },
            );
          }}
        />
        {result ? (
          <View style={{ marginTop: 14 }}>
            <Banner kind={result.ok ? 'ok' : 'error'} text={result.text} />
          </View>
        ) : null}
        <Small style={{ marginTop: 6 }}>Taslakta denemek için: AB12CD veya XY34ZW</Small>
      </Box>
      <V2Note text="Telefon kamerasıyla QR okutma (expo-camera) ve redeem_code() fonksiyonuna bağlanma" />
    </>
  );
}

function Yorumlar() {
  const avgs = { price: 4.6, study: 4.4, portion: 3.1, vibe: 3.9 };
  return (
    <>
      <Box style={{ maxWidth: 560 }}>
        {CRITERIA.map((c) => (
          <ScoreBar key={c.key} label={c.label} value={avgs[c.key]} />
        ))}
        <Small style={{ marginTop: 6 }}>En zayıf kriter: Porsiyon. Öğrenciler bu konuda öneri bırakıyor.</Small>
      </Box>
      <SectionTitle>Son yorumlar</SectionTitle>
      {MOCK_REVIEWS.map((r) => (
        <Box key={r.name} style={{ marginBottom: 12 }}>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.pixel, fontSize: 16, color: colors.ink }}>{r.name}</Text>
            <Badge text={`ÖĞRENCİ · ${r.uni}`} bg={colors.blueSoft} />
            <Badge text={`ORT. ${r.avg}`} bg={colors.greenSoft} />
            <Small>{r.date}</Small>
          </Row>
          <P style={{ marginTop: 6, fontSize: 14 }}>{r.text}</P>
        </Box>
      ))}
      <V2Note text="Mekanın yorumlara yanıt verebilmesi ve uygunsuz yorumu şikayet etmesi" />
    </>
  );
}

function Bilgiler() {
  return (
    <Box bg={colors.paper} style={{ maxWidth: 620 }}>
      <Field label="Mekan adı" value="Tepe Çay Ocağı" editable={false} />
      <Field label="Kategori" value="Kafe" editable={false} />
      <Field label="Adres" value="Tepekent Mah., Büyükçekmece" editable={false} />
      <Field label="Fiyat seviyesi" value="₺ (uygun)" editable={false} />
      <Field label="Yakın kampüs" value="İstanbul Arel Üniversitesi — Tepekent" editable={false} />
      <Small>Mekan bilgileri hesap açılırken Uğrak ekibi tarafından girilir; değişiklik talepleri ekibe iletilir.</Small>
      <V2Note text="Fotoğraf yükleme ve çalışma saatleri" />
    </Box>
  );
}
