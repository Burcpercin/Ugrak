import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Campaign, Scores, VenueDetail } from '@/lib/types';
import { distanceMeters, formatDistance } from '@/lib/universities';
import { useLocation } from '@/lib/location';
import { column, useLayout } from '@/lib/useLayout';
import { OpenToGuests } from '@/components/RequireStudent';
import { StudentOnly } from '@/components/StudentOnly';
import { loadFavorites, toggleFavorite } from '@/lib/favorites';
import { StudentPage } from '@/components/StudentPage';
import { Avatar } from '@/components/Avatar';
import { CampaignCard, CampaignCodeModal } from '@/components/CampaignCode';
import { ReviewForm } from '@/components/ReviewForm';
import { priceText } from '@/components/VenueCard';
import { Badge, Banner, Box, Button, H1, H2, H3, Loading, P, Row, ScoreBar, ScoreTile, Small } from '@/components/ui';
import { ConfirmButton } from '@/components/PanelKit';
import { CATEGORY_LABEL, CRITERIA, colors, fonts } from '@/theme';

export default function MekanPage() {
  return (
    <OpenToGuests>
      <StudentPage>
        <MekanDetay />
      </StudentPage>
    </OpenToGuests>
  );
}

function MekanDetay() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { access, isAdmin } = useAuth();
  const { origin } = useLocation();
  const guest = access === 'guest';
  const { isWide } = useLayout();
  const [data, setData] = useState<VenueDetail | null | undefined>(undefined);
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [modMsg, setModMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [hiding, setHiding] = useState<string | null>(null);
  const [codeFor, setCodeFor] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, favs] = await Promise.all([api.getVenue(id), loadFavorites(guest).catch(() => [] as string[])]);
      setData(d);
      setFav(favs.includes(id));
    } catch {
      setData(null);
    }
  }, [id, guest]);

  useEffect(() => {
    load();
  }, [load]);

  if (data === undefined) return <Loading />;
  if (data === null) {
    return (
      <View>
        <Banner kind="error" text="Mekan bulunamadı." />
        <Button title="Keşfet’e dön" onPress={() => router.replace('/kesfet')} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }

  const { venue: v, stats, campaigns, reviews } = data;
  const mine = reviews.find((r) => r.is_mine) ?? null;
  const dist = origin ? distanceMeters(origin.lat, origin.lng, v.lat, v.lng) : null;

  async function save(scores: Scores, comment: string) {
    setFormError(null);
    setSaved(null);
    setBusy(true);
    try {
      await api.saveReview(v.id, scores, comment);
      await load();
      setSaved(mine ? 'Puanın güncellendi.' : 'Teşekkürler! Puanın kaydedildi.');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteReview(v.id);
      await load();
      setSaved('Yorumun silindi.');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFav() {
    setFav((f) => !f);
    try {
      await toggleFavorite(guest, v.id);
    } catch {
      setFav((f) => !f);
    }
  }

  // ----- Başlık alanı -----
  const header = (
    <View style={{ marginBottom: 20 }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/kesfet'))}
        accessibilityRole="link"
        style={{ alignSelf: 'flex-start', marginBottom: 12 }}
      >
        <Small style={{ color: colors.blue, fontWeight: '700' }}>← Keşfet</Small>
      </Pressable>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <H1 style={{ fontSize: isWide ? 38 : 28 }}>{v.name}</H1>
          <P style={{ color: colors.muted, marginTop: 2 }}>
            {CATEGORY_LABEL[v.category] ?? v.category} · {priceText(v.price_level)} · {v.district}
            {v.address ? `, ${v.address}` : ''}
            {dist != null
              ? ` · ${origin?.source === 'gps' ? 'sana' : origin?.label + ' konumuna'} ${formatDistance(dist)}${dist < 3000 ? ` (yürüyüş ~${Math.max(1, Math.round(dist / 80))} dk)` : ''}`
              : ''}
          </P>
        </View>
        <Button
          small
          variant={fav ? 'danger' : 'secondary'}
          title={fav ? '♥ Favorilerde' : '♡ Favorilere ekle'}
          onPress={toggleFav}
        />
      </Row>
    </View>
  );

  // ----- Sol sütun: bilgi, puanlar, yorumlar -----
  const left = (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
        <View
          style={{
            ...column(isWide, 1),
            minHeight: isWide ? 180 : 120,
            borderWidth: 3,
            borderColor: colors.ink,
            backgroundColor: colors.grey,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <Small>[ mekan fotoğrafı — V2 ]</Small>
          {v.description ? <P style={{ marginTop: 10, fontSize: 14, textAlign: 'center' }}>{v.description}</P> : null}
        </View>
        <View style={column(isWide, 1.2)}>
          <Box style={isWide ? { height: '100%' } : undefined}>
            <Row style={{ gap: 14, marginBottom: 12 }}>
              <ScoreTile value={stats.avg_overall} size={64} />
              <View style={{ flex: 1 }}>
                <H3>Öğrenci puanı</H3>
                <Small>{stats.review_count > 0 ? `${stats.review_count} doğrulanmış öğrenci` : 'Henüz puan yok'}</Small>
              </View>
            </Row>
            {CRITERIA.map((c) => (
              <ScoreBar key={c.key} label={c.label} value={(stats as any)[`avg_${c.key}`]} />
            ))}
          </Box>
        </View>
      </View>

      <View>
        <H2 style={{ marginBottom: 12 }}>Yorumlar ({reviews.length})</H2>
        {modMsg ? <Banner kind={modMsg.kind} text={modMsg.text} /> : null}
        {reviews.length === 0 ? <Small>Henüz yorum yok.</Small> : null}
        {reviews.map((r) => {
          const avg = (r.price + r.study + r.portion + r.vibe) / 4;
          const isMine = r.is_mine;
          return (
            <Box key={r.id} bg={isMine ? colors.orangeSoft : colors.card} style={{ marginBottom: 12 }}>
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <Avatar config={r.avatar} size={38} framed />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    <H3 style={{ fontSize: 15 }}>{r.display_name}</H3>
                    {isMine ? <Badge text="SEN" bg={colors.orange} /> : null}
                    <Badge text={`ÖĞRENCİ${r.university_short ? ' · ' + r.university_short : ''}`} bg={colors.blueSoft} />
                  </Row>
                  <Small>
                    {new Date(r.updated_at).toLocaleDateString('tr-TR')} · ortalama {avg.toFixed(1)}
                  </Small>
                  <Row style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {CRITERIA.map((c) => (
                      <Badge key={c.key} text={`${c.label} ${(r as any)[c.key]}`} bg={colors.paper} />
                    ))}
                  </Row>
                  {r.comment ? <P style={{ marginTop: 8, fontSize: 14 }}>{r.comment}</P> : null}
                  {isAdmin && !isMine ? (
                    // Admin denetimi: yorumu bulunduğu yerden gizler. Yetkiyi veritabanı ayrıca kontrol eder.
                    <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <ConfirmButton
                        title="Gizle"
                        confirmTitle="GİZLENSİN Mİ?"
                        variant="secondary"
                        loading={hiding === r.id}
                        onConfirm={async () => {
                          setHiding(r.id);
                          setModMsg(null);
                          try {
                            await api.adminSetReviewHidden(r.id, true);
                            await load();
                            setModMsg({
                              kind: 'ok',
                              text: `${r.display_name} adlı öğrencinin yorumu gizlendi; puan ortalamasından da çıkarıldı. Geri açmak için: Admin paneli → Yorumlar → Gizlenenler.`,
                            });
                          } catch (e) {
                            setModMsg({ kind: 'error', text: errorMessage(e) });
                          } finally {
                            setHiding(null);
                          }
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              </Row>
            </Box>
          );
        })}
      </View>
    </View>
  );

  // ----- Sağ sütun: kampanyalar ve puan formu -----
  const right = (
    <View style={{ gap: 4 }}>
      {campaigns.length > 0 ? (
        campaigns.map((c) => <CampaignCard key={c.id} c={c} onGetCode={() => setCodeFor(c)} />)
      ) : (
        <Box bg={colors.paper} style={{ marginBottom: 12 }}>
          <Text style={{ fontFamily: fonts.pixel, fontSize: 14, color: colors.ink }}>Aktif kampanya yok</Text>
          <Small>Favorilere eklersen yeni kampanyalar çıktığında haberin olur (V2).</Small>
        </Box>
      )}
      {saved ? <Banner kind="ok" text={saved} /> : null}
      <StudentOnly what="puan vermek ve yorum yazmak">
      <ReviewForm
        isEdit={!!mine}
        initial={mine ? { price: mine.price, study: mine.study, portion: mine.portion, vibe: mine.vibe } : null}
        initialComment={mine?.comment ?? ''}
        busy={busy}
        error={formError}
        onSave={save}
        onDelete={remove}
      />
      </StudentOnly>
    </View>
  );

  return (
    <>
      {header}
      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 28, alignItems: 'flex-start' }}>
        <View style={column(isWide, 1.6)}>{isWide ? left : right}</View>
        <View style={column(isWide, 1)}>{isWide ? right : left}</View>
      </View>
      <CampaignCodeModal campaign={codeFor} venueName={v.name} onClose={() => setCodeFor(null)} />
    </>
  );
}
