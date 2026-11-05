import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { api, errorMessage, isDemo } from '@/lib/api';
import { CATEGORY_KEYS, inIstanbul, parseLatLng, validateVenue } from '@/lib/rules';
import type { AdminCampus, AdminReview, AdminVenue, Application, ApplicationStatus, InviteResult, VenueInput } from '@/lib/types';
import { UNIVERSITIES, universityById } from '@/lib/universities';
import { DemoInbox } from '@/components/DemoInbox';
import { PanelShell, SectionTitle } from '@/components/PanelShell';
import { ConfirmButton, Pill, Sheet, fmtDate, fmtDateTime } from '@/components/PanelKit';
import { RequireRole } from '@/components/RequireRole';
import { Badge, Banner, Box, Button, Field, H3, Loading, P, Row, Small } from '@/components/ui';
import { CATEGORY_LABEL, colors, fonts } from '@/theme';

// =====================================================================
// ADMİN PANELİ
// Başvuruları onaylar (mekan + sahip hesabı açılır, sahibe şifre belirleme
// maili gider), mekanları düzenler/kapatır, yorumları gizler, kampüsleri
// yönetir. Tüm işlemler veritabanında ayrıca admin kontrolünden geçer;
// hesap açma işi sunucu fonksiyonunda (Edge Function "admin-mekan").
// =====================================================================

const NAV = [
  { key: 'basvuru', label: 'Başvurular' },
  { key: 'mekan', label: 'Mekanlar' },
  { key: 'yorum', label: 'Yorumlar' },
  { key: 'kampus', label: 'Kampüsler' },
];

export default function AdminPage() {
  return (
    <RequireRole role="admin">
      <AdminPaneli />
    </RequireRole>
  );
}

function AdminPaneli() {
  const [tab, setTab] = useState('basvuru');
  return (
    <PanelShell title={NAV.find((n) => n.key === tab)!.label} roleLabel="Admin paneli" nav={NAV} active={tab} onNav={setTab}>
      {tab === 'basvuru' && <Basvurular />}
      {tab === 'mekan' && <Mekanlar />}
      {tab === 'yorum' && <Yorumlar />}
      {tab === 'kampus' && <Kampusler />}
    </PanelShell>
  );
}

/** Liste yükleme + hata + tekrar dene kalıbı */
function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await fn());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

function LoadState({ error, loading, onRetry }: { error: string | null; loading: boolean; onRetry: () => void }) {
  if (error) {
    return (
      <>
        <Banner kind="error" text={error} />
        <Button small variant="secondary" title="Tekrar dene" onPress={onRetry} style={{ alignSelf: 'flex-start' }} />
      </>
    );
  }
  return loading ? <Loading /> : null;
}

function Label({ children }: { children: string }) {
  return <Small style={{ fontFamily: fonts.pixel, color: colors.ink, marginBottom: 6 }}>{children.toLocaleUpperCase('tr')}</Small>;
}

// ---------------------------------------------------------------------
// Mekan formu (onay ve düzenleme ortak)
// ---------------------------------------------------------------------

type VenueDraft = {
  name: string;
  category: string;
  district: string;
  address: string;
  description: string;
  coords: string;
  price_level: number;
};

function draftToInput(d: VenueDraft): { input: VenueInput | null; coordError: string | null } {
  const p = parseLatLng(d.coords);
  if (!p) return { input: null, coordError: 'Konumu "41.0627, 28.5937" biçiminde yapıştır.' };
  if (!inIstanbul(p.lat, p.lng)) return { input: null, coordError: 'Bu konum İstanbul sınırları dışında.' };
  return {
    coordError: null,
    input: {
      name: d.name,
      category: d.category,
      district: d.district,
      address: d.address.trim() || null,
      description: d.description.trim() || null,
      lat: p.lat,
      lng: p.lng,
      price_level: d.price_level,
    },
  };
}

function VenueFields({ d, set, touched }: { d: VenueDraft; set: (p: Partial<VenueDraft>) => void; touched: boolean }) {
  const parsed = parseLatLng(d.coords);
  return (
    <>
      <Field label="Mekan adı" value={d.name} onChangeText={(v) => set({ name: v })} maxLength={80} />
      <Label>Kategori</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {CATEGORY_KEYS.map((c) => (
          <Pill key={c} label={CATEGORY_LABEL[c] ?? c} active={d.category === c} onPress={() => set({ category: c })} />
        ))}
      </Row>
      <Label>Fiyat seviyesi</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {[1, 2, 3].map((n) => (
          <Pill key={n} label={'₺'.repeat(n)} active={d.price_level === n} onPress={() => set({ price_level: n })} />
        ))}
      </Row>
      <Field label="Semt" placeholder="ör. Büyükçekmece" value={d.district} onChangeText={(v) => set({ district: v })} maxLength={40} />
      <Field label="Adres (isteğe bağlı)" value={d.address} onChangeText={(v) => set({ address: v })} maxLength={160} />
      <Field label="Açıklama (isteğe bağlı)" value={d.description} onChangeText={(v) => set({ description: v })} maxLength={300} multiline />
      <Field
        label="Konum"
        placeholder="41.0627, 28.5937"
        value={d.coords}
        onChangeText={(v) => set({ coords: v })}
        autoCapitalize="none"
        hint={
          parsed
            ? inIstanbul(parsed.lat, parsed.lng)
              ? `✓ ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)} · İstanbul içinde`
              : '✕ Bu konum İstanbul dışında'
            : 'Google Haritalar’da mekana sağ tıkla → en üstteki koordinata tıkla (kopyalanır) → buraya yapıştır.'
        }
        error={touched && !parsed ? 'Konumu yapıştır.' : null}
      />
    </>
  );
}

// ---------------------------------------------------------------------
// Başvurular
// ---------------------------------------------------------------------

const STATUS: Record<ApplicationStatus, { text: string; bg: string }> = {
  beklemede: { text: 'BEKLEMEDE', bg: colors.yellow },
  gorusuldu: { text: 'GÖRÜŞÜLDÜ', bg: colors.blueSoft },
  onaylandi: { text: 'ONAYLANDI', bg: colors.greenSoft },
  reddedildi: { text: 'REDDEDİLDİ', bg: colors.redSoft },
};
type AppFilter = 'acik' | 'onaylandi' | 'reddedildi' | 'hepsi';

function Basvurular() {
  const { data, error, reload } = useLoad(() => api.adminApplications());
  const [filter, setFilter] = useState<AppFilter>('acik');
  const [approve, setApprove] = useState<Application | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const list = (data ?? []).filter((a) =>
    filter === 'hepsi' ? true : filter === 'acik' ? a.status === 'beklemede' || a.status === 'gorusuldu' : a.status === filter,
  );
  const openCount = (data ?? []).filter((a) => a.status === 'beklemede' || a.status === 'gorusuldu').length;

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        <Pill label={`Açık (${openCount})`} active={filter === 'acik'} onPress={() => setFilter('acik')} />
        <Pill label="Onaylanan" active={filter === 'onaylandi'} onPress={() => setFilter('onaylandi')} />
        <Pill label="Reddedilen" active={filter === 'reddedildi'} onPress={() => setFilter('reddedildi')} />
        <Pill label="Hepsi" active={filter === 'hepsi'} onPress={() => setFilter('hepsi')} />
      </Row>
      {msg ? <Banner kind={msg.kind} text={msg.text} /> : null}
      <LoadState error={error} loading={!data} onRetry={reload} />
      {data && list.length === 0 ? <Small>Bu listede başvuru yok.</Small> : null}
      {list.map((a) => (
        <ApplicationCard
          key={a.id}
          a={a}
          onApprove={() => setApprove(a)}
          onChanged={async (text) => {
            setMsg({ kind: 'ok', text });
            await reload();
          }}
          onError={(text) => setMsg({ kind: 'error', text })}
        />
      ))}
      <Small style={{ marginTop: 8 }}>Mekanlar başvuruyu uygulamadaki “Mekan sahibiyim, başvur” formundan bırakır.</Small>
      <ApproveSheet
        app={approve}
        onClose={() => setApprove(null)}
        onDone={async () => {
          await reload();
        }}
      />
    </>
  );
}

function ApplicationCard({
  a,
  onApprove,
  onChanged,
  onError,
}: {
  a: Application;
  onApprove: () => void;
  onChanged: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [note, setNote] = useState(a.admin_note ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const closed = a.status === 'onaylandi' || a.status === 'reddedildi';

  async function update(patch: Parameters<typeof api.adminUpdateApplication>[1], ok: string, key: string) {
    setBusy(key);
    try {
      await api.adminUpdateApplication(a.id, patch);
      await onChanged(ok);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Box style={{ marginBottom: 12 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <H3>{a.venue_name}</H3>
            <Badge text={STATUS[a.status].text} bg={STATUS[a.status].bg} />
          </Row>
          <Small style={{ color: colors.ink, marginTop: 2 }}>
            {a.contact_name} · {a.phone} · {a.email}
          </Small>
          <Small>
            {a.district ? `${a.district} · ` : ''}Başvuru: {fmtDateTime(a.created_at)}
            {a.decided_at ? ` · Karar: ${fmtDate(a.decided_at)}` : ''}
          </Small>
          {a.note ? <P style={{ fontSize: 14, marginTop: 6 }}>“{a.note}”</P> : null}
        </View>
      </Row>

      <View style={{ marginTop: 10 }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Ekip notu (sadece adminler görür)"
          placeholderTextColor="#9C9488"
          maxLength={500}
          multiline
          style={{ borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, padding: 8, fontSize: 14, color: colors.ink, minHeight: 44 }}
        />
        {note !== (a.admin_note ?? '') ? (
          <Button small variant="secondary" title="Notu kaydet" loading={busy === 'note'} onPress={() => update({ admin_note: note }, 'Not kaydedildi.', 'note')} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
        ) : null}
      </View>

      {!closed ? (
        <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Button small variant="success" title="ONAYLA + MEKANI AÇ" onPress={onApprove} />
          {a.status === 'beklemede' ? (
            <Button small variant="secondary" title="Görüşüldü" loading={busy === 'g'} onPress={() => update({ status: 'gorusuldu' }, `${a.venue_name}: görüşüldü olarak işaretlendi.`, 'g')} />
          ) : null}
          <ConfirmButton title="Reddet" confirmTitle="REDDEDİLSİN Mİ?" loading={busy === 'r'} onConfirm={() => update({ status: 'reddedildi' }, `${a.venue_name}: reddedildi.`, 'r')} />
        </Row>
      ) : a.status === 'reddedildi' ? (
        <Button small variant="secondary" title="Yeniden aç" loading={busy === 'o'} onPress={() => update({ status: 'beklemede' }, `${a.venue_name}: yeniden açıldı.`, 'o')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
      ) : null}
    </Box>
  );
}

function ApproveSheet({ app, onClose, onDone }: { app: Application | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [d, setD] = useState<VenueDraft>({ name: '', category: 'kafe', district: '', address: '', description: '', coords: '', price_level: 1 });
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    if (!app) return;
    setD({ name: app.venue_name, category: 'kafe', district: app.district ?? '', address: '', description: '', coords: '', price_level: 1 });
    setOwnerEmail(app.email);
    setOwnerName(app.contact_name.slice(0, 24));
    setError(null);
    setTouched(false);
    setResult(null);
  }, [app?.id]);

  const { input, coordError } = draftToInput(d);
  const problem = input ? validateVenue(input) : coordError;
  const ownerProblem = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())
    ? 'Sahibin e-postasını doğru gir.'
    : !ownerName.trim()
      ? 'Sahibin adını gir.'
      : null;

  async function submit() {
    setTouched(true);
    setError(null);
    if (!app || !input || problem || ownerProblem) return;
    setBusy(true);
    try {
      const r = await api.adminApprove(app.id, input, { email: ownerEmail, name: ownerName });
      setResult(r);
      await onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={!!app} title={result ? 'Mekan açıldı' : 'Başvuruyu onayla'} onClose={onClose}>
      {result ? (
        <>
          <Banner
            kind={result.mailError ? 'warn' : 'ok'}
            text={
              result.newAccount
                ? result.mailSent
                  ? `${d.name} açıldı. ${ownerEmail.trim()} adresine şifre belirleme maili gönderildi; sahibi şifresini belirleyince panele girebilir.`
                  : `${d.name} açıldı ama mail gönderilemedi (${result.mailError}). Mekanlar sekmesinden “Daveti tekrar gönder” ile yeniden dene.`
                : `${d.name} açıldı ve ${ownerEmail.trim()} adresindeki mevcut mekan hesabına eklendi. Sahibi aynı şifreyle girip mekan seçebilir.`
            }
          />
          {isDemo && result.newAccount ? <DemoInbox email={ownerEmail} kind="reset" /> : null}
          <Button title="TAMAM" onPress={onClose} style={{ marginTop: 10 }} />
        </>
      ) : (
        <>
          <P style={{ fontSize: 14, marginBottom: 10 }}>
            Onaylayınca mekan öğrencilere görünür olur, sahibi için mekan hesabı açılır ve şifre belirleme linki e-postasına gider.
          </P>
          <VenueFields d={d} set={(p) => setD((x) => ({ ...x, ...p }))} touched={touched} />
          <H3 style={{ marginTop: 6, marginBottom: 8 }}>Mekan sahibi hesabı</H3>
          <Field
            label="Sahibin e-postası"
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            hint="İşletme e-postası. Öğrenci (.edu) hesabı olan bir adres mekan sahibi yapılamaz."
          />
          <Field label="Sahibin adı (24 karakter)" value={ownerName} onChangeText={setOwnerName} maxLength={24} />
          {touched && (problem || ownerProblem) ? <Banner kind="error" text={(problem || ownerProblem)!} /> : null}
          {error ? <Banner kind="error" text={error} /> : null}
          <Button title="ONAYLA VE MEKANI AÇ" variant="success" onPress={submit} loading={busy} />
          <Button small variant="secondary" title="Vazgeç" onPress={onClose} style={{ marginTop: 10 }} />
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Mekanlar
// ---------------------------------------------------------------------

function Mekanlar() {
  const { data, error, reload } = useLoad(() => api.adminVenues());
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<AdminVenue | null>(null);
  const [owner, setOwner] = useState<AdminVenue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const list = useMemo(() => {
    const n = q.trim().toLocaleLowerCase('tr');
    return (data ?? []).filter(
      (v) => !n || `${v.name} ${v.district} ${v.owner_email ?? ''}`.toLocaleLowerCase('tr').includes(n),
    );
  }, [data, q]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'ok', text: ok });
      await reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Mekan, semt ya da sahip e-postası ara…"
        placeholderTextColor="#9C9488"
        style={{ borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, padding: 10, fontSize: 15, color: colors.ink, marginBottom: 12 }}
      />
      {msg ? <Banner kind={msg.kind} text={msg.text} /> : null}
      <LoadState error={error} loading={!data} onRetry={reload} />
      {data ? <Small style={{ marginBottom: 8 }}>{list.length} mekan</Small> : null}
      {list.map((v) => (
        <Box key={v.id} style={{ marginBottom: 12 }} bg={v.is_active ? colors.card : colors.paper}>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <H3>{v.name}</H3>
            <Badge text={v.is_active ? 'AÇIK' : 'KAPALI'} bg={v.is_active ? colors.greenSoft : colors.grey} />
          </Row>
          <Small style={{ color: colors.ink }}>
            {CATEGORY_LABEL[v.category] ?? v.category} · {v.district} · {v.live_campaigns} kampanya · {v.review_count} yorum
          </Small>
          <Small style={{ marginTop: 2 }}>
            Sahip:{' '}
            {v.owner_email
              ? `${v.owner_name} (${v.owner_email}) · ${v.owner_joined ? 'giriş yaptı ✓' : 'şifresini henüz belirlemedi'}`
              : 'yok'}
          </Small>
          <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <Button small variant="secondary" title="Düzenle" onPress={() => setEdit(v)} />
            {v.is_active ? (
              <ConfirmButton
                title="Kapat"
                confirmTitle="KAPATILSIN MI?"
                loading={busy === v.id + 'a'}
                onConfirm={() => run(v.id + 'a', () => api.adminUpdateVenue(v.id, { is_active: false }), `${v.name} kapatıldı; öğrencilere görünmüyor.`)}
              />
            ) : (
              <Button small variant="secondary" title="Aç" loading={busy === v.id + 'a'} onPress={() => run(v.id + 'a', () => api.adminUpdateVenue(v.id, { is_active: true }), `${v.name} yeniden açıldı.`)} />
            )}
            {v.owner_email ? (
              <>
                <Button
                  small
                  variant="secondary"
                  title={v.owner_joined ? 'Şifre linki gönder' : 'Daveti tekrar gönder'}
                  loading={busy === v.id + 'i'}
                  onPress={() => run(v.id + 'i', () => api.adminResendInvite(v.id), `${v.owner_email} adresine şifre belirleme linki gönderildi.`)}
                />
                <ConfirmButton
                  title="Sahibi kaldır"
                  confirmTitle="SAHİP KALDIRILSIN MI?"
                  variant="secondary"
                  loading={busy === v.id + 'd'}
                  onConfirm={() => run(v.id + 'd', () => api.adminDetachOwner(v.id), `${v.name}: sahip bağlantısı kaldırıldı (hesap silinmedi).`)}
                />
              </>
            ) : (
              <Button small variant="accent" title="Sahip ata" onPress={() => setOwner(v)} />
            )}
          </Row>
        </Box>
      ))}
      <EditVenueSheet v={edit} onClose={() => setEdit(null)} onSaved={async (t) => { setMsg({ kind: 'ok', text: t }); await reload(); }} />
      <AssignOwnerSheet v={owner} onClose={() => setOwner(null)} onSaved={reload} />
    </>
  );
}

function EditVenueSheet({ v, onClose, onSaved }: { v: AdminVenue | null; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const [d, setD] = useState<VenueDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!v) return;
    setD({
      name: v.name,
      category: v.category,
      district: v.district,
      address: v.address ?? '',
      description: v.description ?? '',
      coords: `${v.lat}, ${v.lng}`,
      price_level: v.price_level,
    });
    setError(null);
  }, [v?.id]);

  if (!v || !d) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;
  const { input, coordError } = draftToInput(d);
  const problem = input ? validateVenue(input) : coordError;

  async function save() {
    setError(null);
    if (!input || problem || !v) return;
    setBusy(true);
    try {
      await api.adminUpdateVenue(v.id, input);
      await onSaved(`${input.name} güncellendi.`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={!!v} title={`Düzenle · ${v.name}`} onClose={onClose}>
      <VenueFields d={d} set={(p) => setD((x) => (x ? { ...x, ...p } : x))} touched />
      {problem ? <Banner kind="error" text={problem} /> : null}
      {error ? <Banner kind="error" text={error} /> : null}
      <Button title="KAYDET" variant="success" onPress={save} loading={busy} disabled={!!problem} />
      <Button small variant="secondary" title="Vazgeç" onPress={onClose} style={{ marginTop: 10 }} />
    </Sheet>
  );
}

function AssignOwnerSheet({ v, onClose, onSaved }: { v: AdminVenue | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    setEmail('');
    setName('');
    setError(null);
    setResult(null);
  }, [v?.id]);

  async function save() {
    if (!v) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.adminAssignOwner(v.id, { email, name });
      setResult(r);
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={!!v} title={`Sahip ata · ${v?.name ?? ''}`} onClose={onClose}>
      {result ? (
        <>
          <Banner
            kind={result.mailError ? 'warn' : 'ok'}
            text={
              result.newAccount
                ? result.mailSent
                  ? `Mekan hesabı açıldı; ${email.trim()} adresine şifre belirleme maili gönderildi.`
                  : `Hesap açıldı ama mail gönderilemedi (${result.mailError}). “Daveti tekrar gönder” ile dene.`
                : `${email.trim()} adresindeki mevcut mekan hesabına bağlandı.`
            }
          />
          {isDemo && result.newAccount ? <DemoInbox email={email} kind="reset" /> : null}
          <Button title="TAMAM" onPress={onClose} style={{ marginTop: 10 }} />
        </>
      ) : (
        <>
          <Field label="Sahibin e-postası" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Sahibin adı (24 karakter)" value={name} onChangeText={setName} maxLength={24} />
          {error ? <Banner kind="error" text={error} /> : null}
          <Button title="SAHİP ATA" variant="accent" onPress={save} loading={busy} disabled={!email.trim() || !name.trim()} />
          <Small style={{ marginTop: 8 }}>
            Adreste mekan hesabı varsa mekan o hesaba eklenir; yoksa yeni hesap açılır ve şifre belirleme linki gönderilir.
          </Small>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Yorumlar (moderasyon)
// ---------------------------------------------------------------------

function Yorumlar() {
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [data, setData] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api.adminReviews(onlyHidden));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [onlyHidden]);
  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);

  async function toggle(r: AdminReview) {
    setBusy(r.id);
    try {
      await api.adminSetReviewHidden(r.id, !r.hidden_at);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        <Pill label="Son yorumlar" active={!onlyHidden} onPress={() => setOnlyHidden(false)} />
        <Pill label="Gizlenenler" active={onlyHidden} onPress={() => setOnlyHidden(true)} />
      </Row>
      <LoadState error={error} loading={!data && !error} onRetry={reload} />
      {data && data.length === 0 ? <Small>Yorum yok.</Small> : null}
      {(data ?? []).map((r) => (
        <Box key={r.id} style={{ marginBottom: 10 }} bg={r.hidden_at ? colors.redSoft : colors.card}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                <H3 style={{ fontSize: 15 }}>{r.venue_name}</H3>
                {r.hidden_at ? <Badge text="GİZLİ" bg={colors.red} fg="#fff" /> : null}
              </Row>
              <Small>
                {r.display_name} · {fmtDate(r.updated_at)} · ortalama {((r.price + r.study + r.portion + r.vibe) / 4).toFixed(1)}
              </Small>
              <P style={{ fontSize: 14, marginTop: 4 }}>{r.comment || '(yorum yok, sadece puan)'}</P>
            </View>
            {r.hidden_at ? (
              <Button small variant="secondary" title="Geri aç" loading={busy === r.id} onPress={() => toggle(r)} />
            ) : (
              <ConfirmButton title="Gizle" confirmTitle="GİZLENSİN Mİ?" loading={busy === r.id} onConfirm={() => toggle(r)} />
            )}
          </Row>
        </Box>
      ))}
      <Small style={{ marginTop: 8 }}>
        Gizlenen yorum silinmez; öğrencilere ve puan ortalamasına yansımaz. Yazarı kendi yorumlarında “gizlendi” olarak görür.
        Yorumları mekan sayfasında da, yorumun hemen altındaki “Gizle” butonuyla gizleyebilirsin; burası tüm
        yorumların toplu listesi ve gizlenenleri geri açma yeri.
      </Small>
    </>
  );
}

// ---------------------------------------------------------------------
// Kampüsler
// ---------------------------------------------------------------------

function Kampusler() {
  const { data, error, reload } = useLoad(() => api.adminCampuses());
  const [edit, setEdit] = useState<(Partial<AdminCampus> & { coords: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const groups = useMemo(() => {
    const m = new Map<number, AdminCampus[]>();
    for (const c of data ?? []) m.set(c.university_id, [...(m.get(c.university_id) ?? []), c]);
    return [...m.entries()];
  }, [data]);

  async function save() {
    if (!edit) return;
    const p = parseLatLng(edit.coords);
    if (!edit.university_id) return setMsg({ kind: 'error', text: 'Üniversite seç.' });
    if (!p || !inIstanbul(p.lat, p.lng)) return setMsg({ kind: 'error', text: 'Konumu İstanbul içinde bir koordinat olarak yapıştır.' });
    setBusy(true);
    setMsg(null);
    try {
      await api.adminSaveCampus({
        id: edit.id,
        university_id: edit.university_id,
        name: edit.name ?? '',
        district: edit.district ?? null,
        lat: p.lat,
        lng: p.lng,
        is_active: edit.is_active ?? true,
      });
      setMsg({ kind: 'ok', text: `${edit.name} kaydedildi.` });
      setEdit(null);
      await reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button small variant="accent" title="+ Kampüs ekle" onPress={() => setEdit({ coords: '', is_active: true })} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
      {msg ? <Banner kind={msg.kind} text={msg.text} /> : null}
      <LoadState error={error} loading={!data} onRetry={reload} />
      {groups.map(([uid, list]) => (
        <View key={uid} style={{ marginBottom: 14 }}>
          <SectionTitle>{universityById(uid)?.name ?? `Üniversite ${uid}`}</SectionTitle>
          {list.map((c) => (
            <Pressable key={c.id} onPress={() => setEdit({ ...c, coords: `${c.lat}, ${c.lng}` })} accessibilityRole="button">
              <Row style={{ gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2dacb' }}>
                <P style={{ flex: 1, fontSize: 14 }}>
                  {c.name}
                  {c.district ? ` · ${c.district}` : ''}
                </P>
                {!c.is_active ? <Badge text="KAPALI" bg={colors.grey} /> : null}
                <Small style={{ color: colors.blue, fontWeight: '700' }}>Düzenle</Small>
              </Row>
            </Pressable>
          ))}
        </View>
      ))}
      <Small>Kampüsler, konum izni vermeyen kullanıcının “Nereye göre?” listesinde görünür.</Small>

      <Sheet visible={!!edit} title={edit?.id ? 'Kampüsü düzenle' : 'Yeni kampüs'} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <Label>Üniversite</Label>
            <Row style={{ flexWrap: 'wrap' }}>
              {UNIVERSITIES.map((u) => (
                <Pill key={u.id} label={u.short_name} active={edit.university_id === u.id} onPress={() => setEdit({ ...edit, university_id: u.id })} />
              ))}
            </Row>
            <Field label="Kampüs adı" value={edit.name ?? ''} onChangeText={(v) => setEdit({ ...edit, name: v })} maxLength={60} />
            <Field label="Semt (isteğe bağlı)" value={edit.district ?? ''} onChangeText={(v) => setEdit({ ...edit, district: v })} maxLength={40} />
            <Field label="Konum" placeholder="41.0627, 28.5937" value={edit.coords} onChangeText={(v) => setEdit({ ...edit, coords: v })} autoCapitalize="none" />
            <Label>Durum</Label>
            <Row style={{ flexWrap: 'wrap' }}>
              <Pill label="Açık" active={edit.is_active !== false} onPress={() => setEdit({ ...edit, is_active: true })} />
              <Pill label="Kapalı" active={edit.is_active === false} onPress={() => setEdit({ ...edit, is_active: false })} />
            </Row>
            {msg?.kind === 'error' ? <Banner kind="error" text={msg.text} /> : null}
            <Button title="KAYDET" variant="success" onPress={save} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}
