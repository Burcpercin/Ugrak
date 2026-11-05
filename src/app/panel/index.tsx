import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { isNative } from '@/lib/useLayout';
import { DURATIONS, MAX_CAMPAIGN_DAYS, MAX_LIVE_CAMPAIGNS, REDEEM_TEXT, normalizeCode, validateCampaign } from '@/lib/rules';
import type { Campaign, OwnerDashboard, OwnerVenue, RedeemResult } from '@/lib/types';
import { Kpi, PanelShell, SectionTitle, Table } from '@/components/PanelShell';
import { ConfirmButton, Pill, fmtDate, fmtDateTime } from '@/components/PanelKit';
import { QrScanner } from '@/components/QrScanner';
import { RequireRole } from '@/components/RequireRole';
import { Avatar } from '@/components/Avatar';
import { priceText } from '@/components/VenueCard';
import { Badge, Banner, Box, Button, Field, H3, Loading, P, Row, ScoreBar, Small } from '@/components/ui';
import { CATEGORY_LABEL, CRITERIA, colors, fonts } from '@/theme';

// =====================================================================
// MEKAN PANELİ
// Mekan sahibinin kod doğruladığı, kampanya yönettiği ve puanlarını
// gördüğü ekran. Veriler: my_venues(), venue_stats, campaigns,
// venue_redemptions (öğrenci kimliği yok), review_feed, redeem_code().
// Yetki kontrolü veritabanında; bu ekran sadece sahibin kendi mekanını gösterir.
// =====================================================================

const NAV = [
  { key: 'kod', label: 'Kod doğrula' },
  { key: 'ozet', label: 'Özet' },
  { key: 'kampanya', label: 'Kampanyalar' },
  { key: 'yorum', label: 'Yorumlar' },
  { key: 'bilgi', label: 'Mekan bilgileri' },
];

const DAY = 24 * 3600 * 1000;

export default function MekanPaneliPage() {
  return (
    <RequireRole role="venue_owner">
      <MekanPaneli />
    </RequireRole>
  );
}

function MekanPaneli() {
  // Telefonda en sık iş kod doğrulamak; webde özet.
  const [tab, setTab] = useState(isNative ? 'kod' : 'ozet');
  const [venues, setVenues] = useState<OwnerVenue[] | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myVenues()
      .then((list) => {
        setVenues(list);
        setVenueId((cur) => cur ?? (list.find((v) => v.is_active) ?? list[0])?.id ?? null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const reload = useCallback(async () => {
    if (!venueId) return;
    try {
      setData(await api.ownerDashboard(venueId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [venueId]);

  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);

  const venue = venues?.find((v) => v.id === venueId) ?? null;

  const header =
    venues && venues.length > 1 ? (
      <View>
        <Small style={{ color: '#bbb', marginBottom: 6 }}>Mekan seç</Small>
        <Row style={{ flexWrap: 'wrap' }}>
          {venues.map((v) => (
            <Pill key={v.id} label={v.name + (v.is_active ? '' : ' (kapalı)')} active={v.id === venueId} onPress={() => setVenueId(v.id)} />
          ))}
        </Row>
      </View>
    ) : null;

  let body: React.ReactNode;
  if (error && !data) {
    body = (
      <>
        <Banner kind="error" text={error} />
        <Button small variant="secondary" title="Tekrar dene" onPress={reload} style={{ alignSelf: 'flex-start' }} />
      </>
    );
  } else if (venues && venues.length === 0) {
    body = (
      <Box>
        <H3 style={{ marginBottom: 6 }}>Hesabına bağlı mekan yok</H3>
        <P style={{ fontSize: 14 }}>
          Mekanın Uğrak ekibi tarafından hesabına bağlandığında burada görünür. Bir sorun olduğunu düşünüyorsan ekiple
          iletişime geç.
        </P>
      </Box>
    );
  } else if (!data || !venue) {
    body = <Loading />;
  } else {
    body = (
      <>
        {!venue.is_active ? (
          <Banner
            kind="warn"
            title="MEKAN ŞU AN KAPALI"
            text="Mekanın öğrencilere görünmüyor; yeni kampanya açılamaz ve kodlar kabul edilmez. Ekiple iletişime geç."
          />
        ) : null}
        {error ? <Banner kind="error" text={error} /> : null}
        {tab === 'kod' && <KodDogrula onDone={reload} />}
        {tab === 'ozet' && <Ozet d={data} />}
        {tab === 'kampanya' && <Kampanyalar d={data} reload={reload} />}
        {tab === 'yorum' && <Yorumlar d={data} />}
        {tab === 'bilgi' && <Bilgiler v={data.venue} />}
      </>
    );
  }

  return (
    <PanelShell
      title={NAV.find((n) => n.key === tab)!.label}
      roleLabel={venue ? `Mekan paneli · ${venue.name}` : 'Mekan paneli'}
      nav={NAV}
      active={tab}
      onNav={setTab}
      header={header}
    >
      {body}
    </PanelShell>
  );
}

// ---------------------------------------------------------------------
// Kod doğrulama
// ---------------------------------------------------------------------

function KodDogrula({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [history, setHistory] = useState<{ at: string; r: RedeemResult }[]>([]);

  async function verify(raw: string) {
    if (busy) return; // çift dokunuşta iki kez gönderme
    setError(null);
    setResult(null);
    const clean = normalizeCode(raw);
    if (!clean) {
      setResult({ ok: false, reason: 'FORMAT', campaign_title: null, used_at: null });
      return;
    }
    setBusy(true);
    try {
      const r = await api.redeemCode(clean);
      setResult(r);
      setHistory((h) => [{ at: new Date().toISOString(), r }, ...h].slice(0, 8));
      if (r.ok) {
        setCode('');
        onDone();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const t = result ? REDEEM_TEXT[result.reason] : null;

  return (
    <>
      <Box>
        <P style={{ fontSize: 14, marginBottom: 10 }}>
          Öğrencinin uygulamada gösterdiği 6 haneli kodu yaz{isNative ? ' ya da QR kodunu okut' : ''}. Kod 10 dakika geçerli
          ve tek kullanımlıktır.
        </P>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9:]/g, '').slice(0, 12))}
          placeholder="K7MQ2X"
          placeholderTextColor="#B5AC9E"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={12}
          onSubmitEditing={() => verify(code)}
          accessibilityLabel="Kampanya kodu"
          style={{
            borderWidth: 3,
            borderColor: colors.ink,
            backgroundColor: colors.card,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 30,
            letterSpacing: 8,
            fontWeight: '800',
            color: colors.ink,
            textAlign: 'center',
            marginBottom: 12,
          }}
        />
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <Button title="DOĞRULA" variant="success" onPress={() => verify(code)} loading={busy} disabled={!code} style={{ flexGrow: 1 }} />
          {isNative ? <Button title="📷 QR OKUT" variant="primary" onPress={() => setScan(true)} style={{ flexGrow: 1 }} /> : null}
        </Row>
      </Box>

      {error ? <Banner kind="error" text={error} /> : null}

      {result && t ? (
        <Box bg={result.ok ? colors.greenSoft : colors.redSoft} style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: fonts.pixel, fontSize: 24, color: result.ok ? colors.green : colors.red }}>
            {result.ok ? '✓ ' : '✕ '}
            {t.title}
          </Text>
          {result.campaign_title ? <P style={{ fontWeight: '700', marginTop: 6 }}>{result.campaign_title}</P> : null}
          <P style={{ fontSize: 14, marginTop: 4 }}>{t.text}</P>
          {result.reason === 'USED' && result.used_at ? <Small style={{ marginTop: 4 }}>Kullanıldığı an: {fmtDateTime(result.used_at)}</Small> : null}
        </Box>
      ) : null}

      {history.length ? (
        <>
          <SectionTitle>Bu oturumda doğrulananlar</SectionTitle>
          {history.map((h, i) => (
            <Row key={i} style={{ gap: 10, marginBottom: 6 }}>
              <Badge text={h.r.ok ? 'ONAY' : 'RED'} bg={h.r.ok ? colors.greenSoft : colors.redSoft} />
              <Small style={{ color: colors.ink, flex: 1 }}>
                {fmtDateTime(h.at)} · {h.r.campaign_title ?? REDEEM_TEXT[h.r.reason].title.toLocaleLowerCase('tr')}
              </Small>
            </Row>
          ))}
        </>
      ) : null}

      <Small style={{ marginTop: 14 }}>
        KVKK: Kodu kullanan öğrencinin kimliğini görmezsin; sadece kodun geçerli olup olmadığını görürsün.
      </Small>

      {isNative ? (
        <QrScanner
          visible={scan}
          onClose={() => setScan(false)}
          onCode={(c) => {
            setCode(c);
            verify(c);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------
// Özet
// ---------------------------------------------------------------------

function Ozet({ d }: { d: OwnerDashboard }) {
  const now = Date.now();
  const used = d.redemptions.filter((r) => r.used_at);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const today = used.filter((r) => new Date(r.used_at!).getTime() >= startToday.getTime()).length;
  const live = d.campaigns.filter((c) => c.is_active && new Date(c.ends_at).getTime() > now && new Date(c.starts_at).getTime() <= now);

  // Son 7 gün (bugün dahil), yerel saate göre
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(startToday.getTime() - (6 - i) * DAY);
    const end = start.getTime() + DAY;
    return {
      label: start.toLocaleDateString('tr-TR', { weekday: 'short' }),
      n: used.filter((r) => {
        const t = new Date(r.used_at!).getTime();
        return t >= start.getTime() && t < end;
      }).length,
    };
  });
  const max = Math.max(1, ...days.map((x) => x.n));
  const week = days.reduce((a, x) => a + x.n, 0);

  return (
    <>
      <Row style={{ flexWrap: 'wrap', gap: 12 }}>
        <Kpi label="Bugün kullanılan kod" value={String(today)} bg={colors.orangeSoft} />
        <Kpi label="Son 7 gün" value={String(week)} note={`son 30 gün: ${used.length}`} />
        <Kpi label="Yürürlükteki kampanya" value={`${live.length}/${MAX_LIVE_CAMPAIGNS}`} />
        <Kpi
          label="Öğrenci puanı"
          value={d.stats.avg_overall != null ? d.stats.avg_overall.toFixed(1) : '—'}
          note={`${d.stats.review_count} doğrulanmış yorum`}
          bg={colors.greenSoft}
        />
        <Kpi label="Favoriye ekleyen" value={String(d.favorites)} />
      </Row>

      <SectionTitle>Son 7 gün · kullanılan kampanya kodu</SectionTitle>
      <Box>
        <Row style={{ alignItems: 'flex-end', height: 170, gap: 10 }}>
          {days.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 13, marginBottom: 4, color: colors.ink }}>{w.n}</Text>
              <View style={{ width: '70%', height: Math.max(4, (w.n / max) * 120), backgroundColor: w.n ? colors.blue : colors.grey, borderWidth: 3, borderColor: colors.ink }} />
              <Small style={{ marginTop: 6 }}>{w.label}</Small>
            </View>
          ))}
        </Row>
      </Box>

      <SectionTitle>Son kod hareketleri</SectionTitle>
      {d.redemptions.length === 0 ? (
        <Small>Son 30 günde kod alınmadı. Bir kampanya açınca öğrenciler kod almaya başlar.</Small>
      ) : (
        <Table
          columns={[
            { key: 'campaign', label: 'Kampanya', width: 230 },
            { key: 'created', label: 'Kod alındı', width: 140 },
            { key: 'used', label: 'Kullanıldı', width: 140 },
            { key: 'status', label: 'Durum', width: 150 },
          ]}
          rows={d.redemptions.slice(0, 15).map((r) => {
            const expired = !r.used_at && new Date(r.expires_at).getTime() < now;
            return {
              campaign: r.campaign_title,
              created: fmtDateTime(r.created_at),
              used: fmtDateTime(r.used_at),
              status: r.used_at ? (
                <Badge text="KULLANILDI" bg={colors.greenSoft} />
              ) : expired ? (
                <Badge text="SÜRESİ DOLDU" bg={colors.grey} />
              ) : (
                <Badge text="BEKLİYOR" bg={colors.orangeSoft} />
              ),
            };
          })}
        />
      )}
      <Small style={{ marginTop: 8 }}>Mekan, kodu alan öğrencinin kimliğini görmez (KVKK).</Small>
    </>
  );
}

// ---------------------------------------------------------------------
// Kampanyalar
// ---------------------------------------------------------------------

type CState = 'live' | 'planned' | 'stopped' | 'ended';
function stateOf(c: Campaign, now: number): CState {
  if (new Date(c.ends_at).getTime() <= now) return 'ended';
  if (!c.is_active) return 'stopped';
  if (new Date(c.starts_at).getTime() > now) return 'planned';
  return 'live';
}
const STATE_LABEL: Record<CState, { text: string; bg: string }> = {
  live: { text: 'YÜRÜRLÜKTE', bg: colors.greenSoft },
  planned: { text: 'PLANLANDI', bg: colors.blueSoft },
  stopped: { text: 'DURDURULDU', bg: colors.orangeSoft },
  ended: { text: 'BİTTİ', bg: colors.grey },
};

function Kampanyalar({ d, reload }: { d: OwnerDashboard; reload: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [discount, setDiscount] = useState('');
  const [desc, setDesc] = useState('');
  const [startTomorrow, setStartTomorrow] = useState(false);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const now = Date.now();
  const liveCount = d.campaigns.filter((c) => c.is_active && new Date(c.ends_at).getTime() > now).length;
  const full = liveCount >= MAX_LIVE_CAMPAIGNS;

  const input = useMemo(() => {
    const start = startTomorrow
      ? (() => {
          const t = new Date();
          t.setDate(t.getDate() + 1);
          t.setHours(9, 0, 0, 0); // yarın 09:00 (yerel saat)
          return t;
        })()
      : new Date();
    return {
      title,
      discount_text: discount,
      description: desc || null,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + days * DAY).toISOString(),
    };
  }, [title, discount, desc, startTomorrow, days]);
  const problem = validateCampaign(input);

  const stats = useMemo(() => {
    const m = new Map<string, { issued: number; used: number }>();
    for (const r of d.redemptions) {
      const x = m.get(r.campaign_id) ?? { issued: 0, used: 0 };
      x.issued++;
      if (r.used_at) x.used++;
      m.set(r.campaign_id, x);
    }
    return m;
  }, [d.redemptions]);

  async function create() {
    setTouched(true);
    setMsg(null);
    if (problem || full || !d.venue.is_active) return;
    setBusy('new');
    try {
      await api.createCampaign(d.venue.id, input);
      setTitle('');
      setDiscount('');
      setDesc('');
      setTouched(false);
      setMsg({ kind: 'ok', text: startTomorrow ? 'Kampanya yarın 09:00’da başlayacak.' : 'Kampanya yayında; öğrenciler şimdi görüyor.' });
      await reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function act(c: Campaign, patch: { is_active?: boolean; ends_at?: string }, ok: string) {
    setMsg(null);
    setBusy(c.id);
    try {
      await api.updateCampaign(c.id, patch);
      setMsg({ kind: 'ok', text: ok });
      await reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const order: CState[] = ['live', 'planned', 'stopped', 'ended'];
  const sorted = [...d.campaigns].sort((a, b) => order.indexOf(stateOf(a, now)) - order.indexOf(stateOf(b, now)));

  return (
    <>
      {msg ? <Banner kind={msg.kind} text={msg.text} /> : null}

      <Box bg={colors.orangeSoft}>
        <H3 style={{ marginBottom: 8 }}>Yeni kampanya</H3>
        {!d.venue.is_active ? (
          <P style={{ fontSize: 14 }}>Mekan kapalıyken kampanya açılamaz.</P>
        ) : full ? (
          <P style={{ fontSize: 14 }}>
            Aynı anda en fazla {MAX_LIVE_CAMPAIGNS} kampanya yürürlükte olabilir. Yenisini açmak için aşağıdan birini durdur.
          </P>
        ) : (
          <>
            <Field label="Başlık" placeholder="ör. Sınav Haftası Çayı" value={title} onChangeText={setTitle} maxLength={60} />
            <Field label="İndirim" placeholder="ör. %20 indirim · 1 alana 1 bedava" value={discount} onChangeText={setDiscount} maxLength={40} />
            <Field label="Açıklama (isteğe bağlı)" placeholder="Koşullar: hangi ürünlerde, hangi saatlerde…" value={desc} onChangeText={setDesc} maxLength={200} multiline />
            <Small style={{ fontFamily: fonts.pixel, color: colors.ink, marginBottom: 6 }}>BAŞLANGIÇ</Small>
            <Row style={{ flexWrap: 'wrap' }}>
              <Pill label="Hemen" active={!startTomorrow} onPress={() => setStartTomorrow(false)} />
              <Pill label="Yarın 09:00" active={startTomorrow} onPress={() => setStartTomorrow(true)} />
            </Row>
            <Small style={{ fontFamily: fonts.pixel, color: colors.ink, marginBottom: 6, marginTop: 4 }}>SÜRE</Small>
            <Row style={{ flexWrap: 'wrap' }}>
              {DURATIONS.map((x) => (
                <Pill key={x.days} label={x.label} active={days === x.days} onPress={() => setDays(x.days)} />
              ))}
            </Row>
            <Small style={{ marginBottom: 10 }}>Bitiş: {fmtDateTime(input.ends_at)}</Small>
            {touched && problem ? <Banner kind="error" text={problem} /> : null}
            <Button title="YAYINLA" variant="accent" onPress={create} loading={busy === 'new'} />
            <Small style={{ marginTop: 8 }}>
              Başladıktan sonra başlık ve indirim değiştirilemez (kodu alan öğrenci yanıltılmasın); durdurup yenisini açabilirsin.
            </Small>
          </>
        )}
      </Box>

      <SectionTitle>Kampanyalarım</SectionTitle>
      {sorted.length === 0 ? <Small>Henüz kampanya yok.</Small> : null}
      {sorted.map((c) => {
        const st = stateOf(c, now);
        const s = stats.get(c.id) ?? { issued: 0, used: 0 };
        const maxEnd = new Date(c.starts_at).getTime() + MAX_CAMPAIGN_DAYS * DAY;
        const extended = Math.min(new Date(c.ends_at).getTime() + 7 * DAY, maxEnd);
        const canExtend = st !== 'ended' && extended > new Date(c.ends_at).getTime();
        return (
          <Box key={c.id} style={{ marginBottom: 12 }} bg={st === 'ended' ? colors.paper : colors.card}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                  <H3>{c.title}</H3>
                  <Badge text={STATE_LABEL[st].text} bg={STATE_LABEL[st].bg} />
                </Row>
                <P style={{ fontSize: 15, fontWeight: '700', marginTop: 2 }}>{c.discount_text}</P>
                {c.description ? <Small style={{ color: colors.ink }}>{c.description}</Small> : null}
                <Small style={{ marginTop: 4 }}>
                  {fmtDate(c.starts_at)} – {fmtDate(c.ends_at)} · son 30 günde {s.issued} kod alındı, {s.used} kullanıldı
                </Small>
              </View>
              <View style={{ gap: 6, alignItems: 'flex-start' }}>
                {st === 'live' || st === 'planned' ? (
                  <ConfirmButton title="Durdur" confirmTitle="DURDURULSUN MU?" variant="secondary" loading={busy === c.id} onConfirm={() => act(c, { is_active: false }, 'Kampanya durduruldu; öğrenciler artık görmüyor.')} />
                ) : null}
                {st === 'stopped' ? (
                  <Button small variant="secondary" title="Yeniden başlat" loading={busy === c.id} disabled={full} onPress={() => act(c, { is_active: true }, 'Kampanya yeniden yayında.')} />
                ) : null}
                {canExtend ? (
                  <Button small variant="secondary" title="+7 gün uzat" loading={busy === c.id} onPress={() => act(c, { ends_at: new Date(extended).toISOString() }, `Bitiş ${fmtDate(new Date(extended).toISOString())} oldu.`)} />
                ) : null}
              </View>
            </Row>
          </Box>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------
// Yorumlar ve bilgiler
// ---------------------------------------------------------------------

function Yorumlar({ d }: { d: OwnerDashboard }) {
  return (
    <>
      <Box>
        <Row style={{ gap: 14, marginBottom: 10 }}>
          <View style={{ borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.orange, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.pixel, fontSize: 26, color: colors.ink }}>
              {d.stats.avg_overall != null ? d.stats.avg_overall.toFixed(1) : '—'}
            </Text>
          </View>
          <Small style={{ flex: 1 }}>{d.stats.review_count} doğrulanmış öğrenci puanı</Small>
        </Row>
        {CRITERIA.map((c) => (
          <ScoreBar key={c.key} label={c.label} value={(d.stats as any)[`avg_${c.key}`]} />
        ))}
      </Box>
      <SectionTitle>Son yorumlar</SectionTitle>
      {d.reviews.length === 0 ? <Small>Henüz yorum yok.</Small> : null}
      {d.reviews.map((r) => (
        <Box key={r.id} style={{ marginBottom: 10 }}>
          <Row style={{ gap: 10, alignItems: 'flex-start' }}>
            <Avatar config={r.avatar} size={36} framed />
            <View style={{ flex: 1 }}>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                <H3 style={{ fontSize: 15 }}>{r.display_name}</H3>
                <Badge text={`ÖĞRENCİ${r.university_short ? ' · ' + r.university_short : ''}`} bg={colors.blueSoft} />
              </Row>
              <Small>
                {fmtDate(r.updated_at)} · Fiyat {r.price} · Ders {r.study} · Porsiyon {r.portion} · Ortam {r.vibe}
              </Small>
              {r.comment ? <P style={{ fontSize: 14, marginTop: 6 }}>{r.comment}</P> : null}
            </View>
          </Row>
        </Box>
      ))}
      <Small>Uygunsuz bir yorum görürsen Uğrak ekibine bildir; ekip yorumu inceleyip gizleyebilir.</Small>
    </>
  );
}

function Bilgiler({ v }: { v: OwnerVenue }) {
  const rows: [string, string][] = [
    ['Ad', v.name],
    ['Kategori', CATEGORY_LABEL[v.category] ?? v.category],
    ['Fiyat seviyesi', priceText(v.price_level)],
    ['Semt', v.district],
    ['Adres', v.address ?? '—'],
    ['Açıklama', v.description ?? '—'],
    ['Konum', `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`],
    ['Durum', v.is_active ? 'Açık (öğrencilere görünüyor)' : 'Kapalı'],
  ];
  return (
    <>
      <Box>
        {rows.map(([k, val]) => (
          <Row key={k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2dacb', gap: 12, alignItems: 'flex-start' }}>
            <Small style={{ width: 120, fontFamily: fonts.pixel, color: colors.ink }}>{k}</Small>
            <P style={{ fontSize: 14, flex: 1 }}>{val}</P>
          </Row>
        ))}
      </Box>
      <Small style={{ marginTop: 10 }}>
        Bilgilerde değişiklik için Uğrak ekibiyle iletişime geç; öğrencilerin doğru mekanı bulması için değişiklikleri ekip yapar.
      </Small>
    </>
  );
}
