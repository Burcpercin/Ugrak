-- =====================================================================
--  UĞRAK — Faz 1 veritabanı güncellemesi (2026-11-04)
--  1) Güvenlik sıkılaştırması
--  2) Misafirin (giriş yapmamış kullanıcı) sadece okuyabilmesi
--  3) Kampüsler tablosu (bir üniversitenin birden fazla kampüsü)
--
--  Nasıl çalıştırılır: Supabase → SQL Editor → New query → bu dosyanın
--  tamamını yapıştır → Run. Önce schema.sql (ve 2026-11-03 dosyası)
--  çalışmış olmalı. Dosya tekrar çalıştırılabilir (idempotent).
--
--  Erişim kuralları supabase/tests/erisim-testi.mjs ile test edilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FONKSİYON YETKİLERİ
--    PostgreSQL fonksiyonları varsayılan olarak herkese (PUBLIC) açar.
--    Önce hepsini kapatıp sadece gerekenleri açıyoruz.
-- ---------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
-- Bundan sonra oluşturulan fonksiyonlar da varsayılan olarak kapalı olsun
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Giriş yapan kullanıcının kendi doğrulama durumu (başka kullanıcıyı sorgulayamaz)
create or replace function public.am_i_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_verified(auth.uid());
$$;

-- RLS kurallarında kullanılan yardımcılar: kural, isteği yapan kullanıcının
-- yetkisiyle değerlendirildiği için giriş yapmış kullanıcıya açık olmalı.
grant execute on function public.am_i_verified()      to authenticated;
grant execute on function public.is_admin()           to authenticated;
grant execute on function public.owns_venue(uuid)     to authenticated;
-- Uygulamanın çağırdığı işlemler: sadece giriş yapmış kullanıcı
grant execute on function public.create_redemption(uuid) to authenticated;
grant execute on function public.refresh_verification()  to authenticated;
-- is_verified(uuid), university_for_email, tetikleyici fonksiyonları: kimseye açık değil

-- ---------------------------------------------------------------------
-- 2. PROFİLLER: veri sınırları
-- ---------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len
  check (char_length(btrim(display_name)) between 1 and 24);

alter table public.profiles drop constraint if exists profiles_avatar_size;
alter table public.profiles add constraint profiles_avatar_size
  check (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) <= 1024);

-- Kayıtta gelen takma ad sınırı aşarsa kaydı bozmasın: kısalt
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 24);
begin
  insert into public.profiles (id, email, display_name, university_id, verified_at, kvkk_accepted_at)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(v_name, ''), 'Uğrakçı'),
    public.university_for_email(new.email),
    new.email_confirmed_at,
    case when (new.raw_user_meta_data ->> 'kvkk_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. YORUMLAR
--    - Tablo sadece kendi yorumun için okunur; herkes yorumları
--      kimliksiz "review_feed" görünümünden okur.
--    - Admin yorum gizleyebilsin diye hidden_at (Faz 2'de kullanılacak).
--    - Güncellemede sadece puan ve yorum metni değişebilir.
-- ---------------------------------------------------------------------

alter table public.reviews add column if not exists hidden_at timestamptz;

drop policy if exists "reviews_read" on public.reviews;
drop policy if exists "reviews_read_own" on public.reviews;
create policy "reviews_read_own" on public.reviews
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews_insert_verified" on public.reviews;
create policy "reviews_insert_verified" on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.am_i_verified()
    and exists (select 1 from public.venues v where v.id = venue_id and v.is_active)
  );

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.am_i_verified());

revoke insert, update on public.reviews from anon, authenticated;
grant insert (user_id, venue_id, price, study, portion, vibe, comment) on public.reviews to authenticated;
grant update (price, study, portion, vibe, comment) on public.reviews to authenticated;
revoke all on public.reviews from anon;

-- Yorum akışı: sadece görünür sütunlar. Yazarın kimliği ve e-postası yok;
-- "is_mine" isteği yapan kişinin kendi yorumu mu, onu söyler.
drop view if exists public.review_feed;
create view public.review_feed as
select
  r.id, r.venue_id,
  r.price, r.study, r.portion, r.vibe, r.comment,
  r.created_at, r.updated_at,
  coalesce(r.user_id = auth.uid(), false) as is_mine,
  p.display_name, p.avatar,
  u.short_name as university_short
from public.reviews r
join public.profiles p on p.id = r.user_id
left join public.universities u on u.id = p.university_id
where r.hidden_at is null;

-- Mekan istatistikleri: sadece toplamlar (kişisel veri yok), gizlenen yorumlar sayılmaz
drop view if exists public.venue_stats;
create view public.venue_stats as
select
  v.id as venue_id,
  count(r.id)::int                       as review_count,
  round(avg(r.price)::numeric, 1)        as avg_price,
  round(avg(r.study)::numeric, 1)        as avg_study,
  round(avg(r.portion)::numeric, 1)      as avg_portion,
  round(avg(r.vibe)::numeric, 1)         as avg_vibe,
  round(avg((r.price + r.study + r.portion + r.vibe) / 4.0)::numeric, 1) as avg_overall
from public.venues v
left join public.reviews r on r.venue_id = v.id and r.hidden_at is null
where v.is_active
group by v.id;

revoke all on public.review_feed, public.venue_stats from public, anon, authenticated;
grant select on public.review_feed, public.venue_stats to anon, authenticated;

-- Kullanıcının kendi yorumları (mekan adıyla) — profil sayfası için
drop view if exists public.my_reviews;
create view public.my_reviews
with (security_invoker = true) as
select r.id, r.venue_id, v.name as venue_name,
       r.price, r.study, r.portion, r.vibe, r.comment, r.created_at, r.updated_at,
       (r.hidden_at is not null) as is_hidden
from public.reviews r
join public.venues v on v.id = r.venue_id
where r.user_id = auth.uid();
revoke all on public.my_reviews from public, anon, authenticated;
grant select on public.my_reviews to authenticated;

-- ---------------------------------------------------------------------
-- 4. MEKANLAR: misafir de okuyabilir; mekan sahibinin kimliği gizli
-- ---------------------------------------------------------------------

-- Misafir: sadece aktif mekanlar (anon yardımcı fonksiyon çağıramadığı için ayrı kural)
drop policy if exists "venues_read_anon" on public.venues;
create policy "venues_read_anon" on public.venues
  for select to anon using (is_active);
drop policy if exists "venues_read" on public.venues;
create policy "venues_read" on public.venues
  for select to authenticated
  using (is_active or public.is_admin() or owner_id = auth.uid());

-- owner_id sütunu API'den okunamasın (sütun düzeyi yetki)
revoke select on public.venues from anon, authenticated;
grant select (id, name, category, description, district, address, lat, lng, price_level, university_id, is_active, created_at)
  on public.venues to anon, authenticated;
revoke insert, update, delete on public.venues from anon;

-- ---------------------------------------------------------------------
-- 5. KAMPANYALAR: misafir aktif kampanyaları görür (kodu alamaz)
-- ---------------------------------------------------------------------

drop policy if exists "campaigns_read_anon" on public.campaigns;
create policy "campaigns_read_anon" on public.campaigns
  for select to anon
  using (is_active and now() between starts_at and ends_at);
revoke insert, update, delete on public.campaigns from anon;

-- ---------------------------------------------------------------------
-- 6. KAMPANYA KODLARI: mekan sahibi öğrencinin kimliğini göremez
-- ---------------------------------------------------------------------

drop policy if exists "redemptions_read" on public.redemptions;
drop policy if exists "redemptions_read_own" on public.redemptions;
create policy "redemptions_read_own" on public.redemptions
  for select to authenticated using (user_id = auth.uid());
revoke all on public.redemptions from anon;
revoke insert, update, delete on public.redemptions from authenticated;

-- Mekan sahibinin kendi mekanının kod kullanımlarını kimliksiz görmesi (Faz 2 paneli)
drop view if exists public.venue_redemptions;
create view public.venue_redemptions as
select r.id, r.campaign_id, c.title as campaign_title, c.venue_id,
       r.created_at, r.expires_at, r.used_at
from public.redemptions r
join public.campaigns c on c.id = r.campaign_id
join public.venues v on v.id = c.venue_id
where v.owner_id = auth.uid() or public.is_admin();
revoke all on public.venue_redemptions from public, anon, authenticated;
grant select on public.venue_redemptions to authenticated;

-- Kod kullanma: mekana öğrencinin kimliğini döndürmez
drop function if exists public.redeem_code(text);
create function public.redeem_code(p_code text)
returns table (campaign_title text, used_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_used timestamptz;
  v_expires timestamptz;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'UGRAK_AUTH: Oturum yok.';
  end if;

  select r.id, r.used_at, r.expires_at, c.title
    into v_id, v_used, v_expires, v_title
  from public.redemptions r
  join public.campaigns c on c.id = r.campaign_id
  join public.venues v on v.id = c.venue_id
  where r.code = upper(btrim(p_code)) and v.owner_id = auth.uid()
  for update of r;

  if v_id is null then
    raise exception 'UGRAK_CODE: Kod bulunamadı ya da bu mekana ait değil.';
  end if;
  if v_used is not null then
    raise exception 'UGRAK_CODE_USED: Bu kod daha önce kullanılmış.';
  end if;
  if v_expires < now() then
    raise exception 'UGRAK_CODE_EXPIRED: Kodun süresi dolmuş.';
  end if;

  update public.redemptions set used_at = now() where id = v_id returning redemptions.used_at into v_used;
  campaign_title := v_title;
  used_at := v_used;
  return next;
end;
$$;
revoke execute on function public.redeem_code(text) from public, anon, authenticated;
grant execute on function public.redeem_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. MEKAN BAŞVURULARI: alan sınırları ve basit spam koruması
-- ---------------------------------------------------------------------

alter table public.venue_applications drop constraint if exists venue_applications_len;
alter table public.venue_applications add constraint venue_applications_len check (
  char_length(venue_name) between 2 and 80
  and char_length(contact_name) between 2 and 60
  and char_length(phone) between 7 and 20
  and char_length(email) between 5 and 120 and email like '%@%.%'
  and (district is null or char_length(district) <= 40)
  and (note is null or char_length(note) <= 500)
);

create or replace function public.limit_venue_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Aynı telefon ya da e-posta ile 24 saatte bir başvuru
  if exists (
    select 1 from public.venue_applications a
    where (a.phone = new.phone or lower(a.email) = lower(new.email))
      and a.created_at > now() - interval '24 hours'
  ) then
    raise exception 'UGRAK_APPLY: Bu iletişim bilgisiyle son 24 saatte zaten başvuru yapılmış.';
  end if;
  -- Toplamda saatte en fazla 30 başvuru (otomatik doldurmaya karşı)
  if (select count(*) from public.venue_applications where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'UGRAK_APPLY: Şu an çok fazla başvuru var, lütfen daha sonra tekrar dene.';
  end if;
  return new;
end;
$$;

drop trigger if exists venue_applications_limit on public.venue_applications;
create trigger venue_applications_limit
  before insert on public.venue_applications
  for each row execute function public.limit_venue_applications();

-- Başvuru yapan sadece ekleyebilir; durum alanını kendisi belirleyemez
revoke all on public.venue_applications from anon, authenticated;
grant insert (venue_name, contact_name, phone, email, district, note) on public.venue_applications to anon, authenticated;
grant select, update on public.venue_applications to authenticated; -- RLS: sadece admin

-- ---------------------------------------------------------------------
-- 8. KAMPÜSLER
--    Bir üniversitenin birden fazla kampüsü olabilir. Konum izni vermeyen
--    kullanıcı mekanları bir kampüse göre sıralamak için buradan seçer.
--    Koordinatlar yaklaşıktır; admin panelinden düzeltilebilir (Faz 2).
-- ---------------------------------------------------------------------

create table if not exists public.campuses (
  id             serial primary key,
  university_id  int not null references public.universities (id) on delete cascade,
  name           text not null,
  district       text,
  lat            double precision not null,
  lng            double precision not null,
  is_active      boolean not null default true,
  unique (university_id, name)
);

alter table public.campuses enable row level security;
drop policy if exists "campuses_read" on public.campuses;
create policy "campuses_read" on public.campuses
  for select to anon, authenticated using (is_active);
drop policy if exists "campuses_admin" on public.campuses;
create policy "campuses_admin" on public.campuses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.campuses from anon;
grant select on public.campuses to anon;

-- Mevcut tek kampüsleri taşı
insert into public.campuses (university_id, name, lat, lng)
select id, campus_name, lat, lng from public.universities
on conflict (university_id, name) do nothing;

-- Bilinen ek kampüsler (yaklaşık koordinat)
insert into public.campuses (university_id, name, district, lat, lng)
select u.id, x.name, x.district, x.lat, x.lng
from (values
  (1, 'Cevizlibağ Yerleşkesi', 'Zeytinburnu', 41.0164, 28.9147),
  (2, 'Taşkışla Yerleşkesi',   'Beyoğlu',     41.0385, 28.9876),
  (2, 'Maçka Yerleşkesi',      'Şişli',       41.0439, 28.9939),
  (4, 'Yıldız Yerleşkesi',     'Beşiktaş',    41.0494, 29.0094)
) as x(uid, name, district, lat, lng)
join public.universities u on u.id = x.uid
on conflict (university_id, name) do nothing;

-- Mekanlar artık bir üniversiteye bağlı değil (konuma göre listeleniyor).
-- university_id geriye uyumluluk için kalıyor, zorunlu değil.
alter table public.venues alter column university_id drop not null;

-- =====================================================================
-- 9. SON KİLİT: fonksiyon yetkilerini en sonda bir kez daha sıfırla
-- PostgreSQL yeni her fonksiyonu varsayılan olarak herkese (PUBLIC) açar ve
-- şema bazlı "default privileges" bunu kapatamaz. Bu yüzden bu dosyada
-- oluşturulanlar dahil hepsini burada kapatıp sadece gerekenleri açıyoruz.
-- =====================================================================
alter default privileges revoke execute on functions from public;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.am_i_verified()          to authenticated;
grant execute on function public.is_admin()               to authenticated;
grant execute on function public.owns_venue(uuid)         to authenticated;
grant execute on function public.create_redemption(uuid)  to authenticated;
grant execute on function public.refresh_verification()   to authenticated;
grant execute on function public.redeem_code(text)        to authenticated;

-- =====================================================================
-- Kontrol: aşağıdaki sorgu misafirin çalıştırabildiği fonksiyonları listeler,
-- boş dönmeli.
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
-- =====================================================================
