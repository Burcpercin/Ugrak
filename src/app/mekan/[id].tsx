import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Campaign, VenueDetail } from '@/lib/types';
import { distanceMeters, formatDistance, universityById } from '@/lib/universities';
import { RequireStudent } from '@/components/RequireStudent';
import { Avatar } from '@/components/Avatar';
import { CampaignCard, CampaignCodeModal } from '@/components/CampaignCode';
import { ReviewForm } from '@/components/ReviewForm';
import { priceText } from '@/components/VenueCard';
import { Badge, Banner, Box, Button, H1, H3, Loading, P, Row, ScoreBar, ScoreTile, Screen, Small } from '@/components/ui';
import { CATEGORY_LABEL, CRITERIA, colors } from '@/theme';

export default function MekanPage() {
  return (
    <RequireStudent>
      <MekanDetay />
    </RequireStudent>
  );
}

function MekanDetay() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [data, setData] = useState<VenueDetail | null | undefined>(undefined);
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [codeFor, setCodeFor] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, favs] = await Promise.all([api.getVenue(id), api.listFavorites()]);
      setData(d);
      setFav(favs.includes(id));
    } catch {
      setData(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (data === undefined) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (data === null) {
    return (
      <Screen>
        <Banner kind="error" text="Mekan bulunamadı." />
        <Button title="Keşfet’e dön" onPress={() => router.replace('/kesfet')} />
      </Screen>
    );
  }

  const { venue: v, stats, campaigns, reviews } = data;
  const mine = reviews.find((r) => r.user_id === profile?.id) ?? null;
  const uni = universityById(profile?.university_id);
  const dist = uni ? distanceMeters(uni.lat, uni.lng, v.lat, v.lng) : null;

  async function save(scores: any, comment: string) {
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

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Button
          small
          variant="secondary"
          title="← Geri"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/kesfet'))}
        />
        <Pressable
          onPress={async () => {
            setFav((f) => !f);
            try {
              await api.toggleFavorite(v.id);
            } catch {
              setFav((f) => !f);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        >
          <Small style={{ fontSize: 28, color: fav ? colors.red : colors.ink, lineHeight: 30 }}>{fav ? '♥' : '♡'}</Small>
        </Pressable>
      </Row>

      {/* Mekan bilgisi */}
      <Box bg={colors.blueSoft}>
        <View style={{ height: 110, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.grey, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Small>[ mekan fotoğrafı — V2 ]</Small>
        </View>
        <H1 style={{ fontSize: 26 }}>{v.name}</H1>
        <Small style={{ color: colors.ink, marginTop: 2 }}>
          {CATEGORY_LABEL[v.category] ?? v.category} · {priceText(v.price_level)} · {v.district}
          {v.address ? `, ${v.address}` : ''}
        </Small>
        {dist != null ? (
          <Small style={{ marginTop: 2 }}>
            {uni?.short_name} kampüsüne {formatDistance(dist)} (yürüyüş ~{Math.max(1, Math.round(dist / 80))} dk)
          </Small>
        ) : null}
        {v.description ? <P style={{ marginTop: 8, fontSize: 14 }}>{v.description}</P> : null}
      </Box>

      {/* Puanlar */}
      <Box style={{ marginTop: 16 }}>
        <Row style={{ gap: 14, marginBottom: 12 }}>
          <ScoreTile value={stats.avg_overall} size={64} />
          <View style={{ flex: 1 }}>
            <H3>Öğrenci puanı</H3>
            <Small>
              {stats.review_count > 0 ? `${stats.review_count} doğrulanmış öğrenci` : 'Henüz puan yok'}
            </Small>
          </View>
        </Row>
        {CRITERIA.map((c) => (
          <ScoreBar key={c.key} label={c.label} value={(stats as any)[`avg_${c.key}`]} />
        ))}
      </Box>

      {/* Kampanyalar */}
      {campaigns.length > 0 ? (
        <View style={{ marginTop: 18 }}>
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} onGetCode={() => setCodeFor(c)} />
          ))}
        </View>
      ) : null}

      {/* Puan ver / düzenle */}
      <View style={{ marginTop: 18 }}>
        {saved ? <Banner kind="ok" text={saved} /> : null}
        <ReviewForm
          isEdit={!!mine}
          initial={mine ? { price: mine.price, study: mine.study, portion: mine.portion, vibe: mine.vibe } : null}
          initialComment={mine?.comment ?? ''}
          busy={busy}
          error={formError}
          onSave={save}
          onDelete={remove}
        />
      </View>

      {/* Yorumlar */}
      <H3 style={{ marginTop: 22, marginBottom: 10 }}>Yorumlar ({reviews.length})</H3>
      {reviews.length === 0 ? <Small>İlk yorumu sen yaz.</Small> : null}
      {reviews.map((r) => {
        const avg = (r.price + r.study + r.portion + r.vibe) / 4;
        const isMine = r.user_id === profile?.id;
        return (
          <Box key={r.id} bg={isMine ? colors.orangeSoft : colors.card} style={{ marginBottom: 12 }}>
            <Row style={{ gap: 10, alignItems: 'flex-start' }}>
              <Avatar config={r.avatar} size={34} framed />
              <View style={{ flex: 1 }}>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  <H3 style={{ fontSize: 15 }}>{r.display_name}</H3>
                  {isMine ? <Badge text="SEN" bg={colors.orange} /> : null}
                  <Badge text={`ÖĞRENCİ${r.university_short ? ' · ' + r.university_short : ''}`} bg={colors.blueSoft} />
                </Row>
                <Small>
                  {new Date(r.updated_at).toLocaleDateString('tr-TR')} · ortalama {avg.toFixed(1)}
                </Small>
              </View>
            </Row>
            <Row style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {CRITERIA.map((c) => (
                <Badge key={c.key} text={`${c.label} ${(r as any)[c.key]}`} bg={colors.paper} />
              ))}
            </Row>
            {r.comment ? <P style={{ marginTop: 8, fontSize: 14 }}>{r.comment}</P> : null}
          </Box>
        );
      })}

      <CampaignCodeModal campaign={codeFor} venueName={v.name} onClose={() => setCodeFor(null)} />
    </Screen>
  );
}
