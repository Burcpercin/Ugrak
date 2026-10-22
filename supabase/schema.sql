-- =====================================================================
--  UĞRAK — Supabase / PostgreSQL veritabanı şeması (V1)
--  Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını
--  yapıştır → Run. Dosya baştan sona tek seferde çalışacak şekilde yazıldı.
--
--  İçerik:
--   1. Tablolar
--   2. Yardımcı fonksiyonlar (domain kontrolü, doğrulama süresi, roller)
--   3. auth.users tetikleyicileri (kayıtta edu kontrolü, profil oluşturma,
--      mail doğrulanınca öğrenci statüsü)
--   4. RPC fonksiyonları (yıllık yeniden doğrulama, kampanya kodu üretme,
--      kodu mekanda kullanma)
--   5. Görünümler (mekan istatistikleri, yorum akışı)
--   6. RLS (satır düzeyi güvenlik) kuralları
--   7. Örnek veri (üniversiteler, mekanlar, kampanyalar)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABLOLAR
-- ---------------------------------------------------------------------

-- İstanbul'daki üniversiteler ve kabul edilen e-posta alan adları.
-- Bir e-posta, listedeki alan adının kendisiyle ya da bir alt alan adıyla
-- bitiyorsa (ör. std.yildiz.edu.tr → yildiz.edu.tr) o üniversiteye bağlanır.
-- NOT: Personel/öğrenci ayrımı için her üniversitenin öğrenci mail formatı
-- tek tek kontrol edilmeli; kontrol edilenlerde domains yalnızca öğrenci
-- alt alan adını içermeli ve student_domains_verified = true yapılmalı.
create table if not exists public.universities (
  id                        serial primary key,
  name                      text not null,
  short_name                text not null,
  domains                   text[] not null,
  student_domains_verified  boolean not null default false,
  campus_name               text not null,
  lat                       double precision not null,
  lng                       double precision not null,
  is_active                 boolean not null default true
);

-- Kullanıcı profili. auth.users ile 1-1 ilişkili, kayıtta otomatik oluşur.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null unique,
  display_name      text not null default 'Uğrakçı',
  university_id     int references public.universities (id),
  avatar            jsonb not null default '{}'::jsonb,
  role              text not null default 'student'
                      check (role in ('student', 'venue_owner', 'admin')),
  verified_at       timestamptz,          -- son başarılı edu doğrulaması
  kvkk_accepted_at  timestamptz,          -- aydınlatma metni onayı
  created_at        timestamptz not null default now()
);

create table if not exists public.venues (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null check (category in ('kafe', 'restoran', 'fastfood', 'tatli', 'bar', 'kutuphane-kafe')),
  description    text,
  district       text not null,
  address        text,
  lat            double precision not null,
  lng            double precision not null,
  price_level    smallint not null check (price_level between 1 and 3),
  university_id  int references public.universities (id),   -- yakın olduğu kampüs
  owner_id       uuid references public.profiles (id),      -- mekan sahibi hesabı
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 4 kriterli öğrenci puanı. Kullanıcı başına mekan başına tek yorum.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  price       smallint not null check (price between 1 and 5),    -- fiyat/performans
  study       smallint not null check (study between 1 and 5),    -- ders çalışmaya uygunluk
  portion     smallint not null check (portion between 1 and 5),  -- porsiyon
  vibe        smallint not null check (vibe between 1 and 5),     -- ortam
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, venue_id)
);

create table if not exists public.campaigns (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  title          text not null,
  description    text,
  discount_text  text not null,                 -- ör. "%20 indirim"
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Öğrencinin aldığı tek kullanımlık, süreli kampanya kodları.
create table if not exists public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  code         text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, venue_id)
);

-- Mekan sahiplerinin bizimle iletişime geçtiği başvurular (admin paneli).
create table if not exists public.venue_applications (
  id            uuid primary key default gen_random_uuid(),
  venue_name    text not null,
  contact_name  text not null,
  phone         text not null,
  email         text not null,
  district      text,
  note          text,
  status        text not null default 'beklemede'
                  check (status in ('beklemede', 'gorusuldu', 'onaylandi', 'reddedildi')),
  created_at    timestamptz not null default now()
);

create index if not exists reviews_venue_idx     on public.reviews (venue_id);
create index if not exists campaigns_venue_idx   on public.campaigns (venue_id);
create index if not exists venues_univ_idx       on public.venues (university_id);
create index if not exists redemptions_user_idx  on public.redemptions (user_id, campaign_id);

-- ---------------------------------------------------------------------
-- 2. YARDIMCI FONKSİYONLAR
-- ---------------------------------------------------------------------

-- E-posta adresinden üniversiteyi bulur. Eşleşme yoksa null döner.
create or replace function public.university_for_email(p_email text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.universities u, unnest(u.domains) d
  where u.is_active
    and (
      lower(split_part(p_email, '@', 2)) = lower(d)
      or lower(split_part(p_email, '@', 2)) like '%.' || lower(d)
    )
  order by length(d) desc
  limit 1;
$$;

-- Doğrulaması son 1 yıl içinde yapılmış mı? (yıllık yeniden doğrulama)
create or replace function public.is_verified(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select verified_at > now() - interval '1 year' from public.profiles where id = p_uid),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.owns_venue(p_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.venues where id = p_venue and owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 3. auth.users TETİKLEYİCİLERİ
-- ---------------------------------------------------------------------

-- 3a. Kayıt öncesi: sadece listedeki İstanbul üniversitelerinin
--     .edu.tr adresleri kabul edilir. (Uygulama da aynı kontrolü yapar;
--     bu tetikleyici API'nin doğrudan çağrılmasına karşı son savunma hattı.)
create or replace function public.check_edu_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.university_for_email(new.email) is null then
    raise exception 'UGRAK_DOMAIN: Bu e-posta adresi desteklenen bir İstanbul üniversitesine ait değil.';
  end if;
  return new;
end;
$$;

drop trigger if exists ugrak_check_edu_email on auth.users;
create trigger ugrak_check_edu_email
  before insert on auth.users
  for each row execute function public.check_edu_email();

-- 3b. Kayıt sonrası: profil satırını oluştur.
--     display_name ve KVKK onayı, kayıt sırasında options.data ile gelir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, university_id, verified_at, kvkk_accepted_at)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Uğrakçı'),
    public.university_for_email(new.email),
    new.email_confirmed_at,                       -- doğrulama gerekiyorsa null gelir
    case when (new.raw_user_meta_data ->> 'kvkk_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ugrak_on_auth_user_created on auth.users;
create trigger ugrak_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3c. Doğrulama mailindeki linke tıklanınca email_confirmed_at dolar;
--     bu anda kullanıcı "doğrulanmış öğrenci" olur.
create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at <> new.email_confirmed_at) then
    update public.profiles set verified_at = new.email_confirmed_at where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ugrak_on_email_confirmed on auth.users;
create trigger ugrak_on_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_email_confirmed();

-- ---------------------------------------------------------------------
-- 4. RPC FONKSİYONLARI (uygulamadan supabase.rpc(...) ile çağrılır)
-- ---------------------------------------------------------------------

-- 4a. Yıllık yeniden doğrulama.
--     Akış: uygulama signInWithOtp({ email }) ile edu adresine 6 haneli kod
--     gönderir → kullanıcı kodu girer (verifyOtp) → bu fonksiyon çağrılır.
--     Fonksiyon, oturumun son 15 dakika içinde e-posta koduyla açıldığını
--     JWT'deki "amr" bilgisinden kontrol eder.
create or replace function public.refresh_verification()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'UGRAK_AUTH: Oturum yok.';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
    where e ->> 'method' in ('otp', 'magiclink', 'email/signup')
      and (e ->> 'timestamp')::bigint > extract(epoch from v_now) - 900
  ) into v_ok;

  if not v_ok then
    raise exception 'UGRAK_REVERIFY: Önce e-posta adresine gelen kodla doğrulama yapılmalı.';
  end if;

  update public.profiles set verified_at = v_now where id = auth.uid();
  return v_now;
end;
$$;

-- 4b. Kampanya kodu üret: 10 dakika geçerli, tek kullanımlık.
--     Aynı kampanya için süresi dolmamış, kullanılmamış kod varsa onu döner.
create or replace function public.create_redemption(p_campaign uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.redemptions;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- karışan karakterler yok
  i int;
begin
  if auth.uid() is null or not public.is_verified(auth.uid()) then
    raise exception 'UGRAK_VERIFY: Kampanya kodu için doğrulanmış öğrenci olmalısın.';
  end if;

  if not exists (
    select 1 from public.campaigns c
    where c.id = p_campaign and c.is_active and now() between c.starts_at and c.ends_at
  ) then
    raise exception 'UGRAK_CAMPAIGN: Kampanya aktif değil.';
  end if;

  select * into v_row from public.redemptions
  where user_id = auth.uid() and campaign_id = p_campaign
    and used_at is null and expires_at > now()
  order by created_at desc limit 1;
  if found then
    return v_row;
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;

  insert into public.redemptions (campaign_id, user_id, code, expires_at)
  values (p_campaign, auth.uid(), v_code, now() + interval '10 minutes')
  returning * into v_row;
  return v_row;
end;
$$;

-- 4c. Mekan sahibi kodu okutur/girer → kod kullanıldı olarak işaretlenir.
--     (V1'de mekan paneli taslak; fonksiyon V2 için hazır.)
create or replace function public.redeem_code(p_code text)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.redemptions;
begin
  select r.* into v_row
  from public.redemptions r
  join public.campaigns c on c.id = r.campaign_id
  join public.venues v on v.id = c.venue_id
  where r.code = upper(p_code) and v.owner_id = auth.uid()
  for update of r;

  if not found then
    raise exception 'UGRAK_CODE: Kod bulunamadı ya da bu mekana ait değil.';
  end if;
  if v_row.used_at is not null then
    raise exception 'UGRAK_CODE_USED: Bu kod daha önce kullanılmış.';
  end if;
  if v_row.expires_at < now() then
    raise exception 'UGRAK_CODE_EXPIRED: Kodun süresi dolmuş.';
  end if;

  update public.redemptions set used_at = now() where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- reviews.updated_at otomatik güncellensin
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. GÖRÜNÜMLER
-- ---------------------------------------------------------------------

-- Mekan başına kriter ortalamaları ve yorum sayısı.
create or replace view public.venue_stats
with (security_invoker = true) as
select
  v.id as venue_id,
  count(r.id)::int                       as review_count,
  round(avg(r.price)::numeric, 1)        as avg_price,
  round(avg(r.study)::numeric, 1)        as avg_study,
  round(avg(r.portion)::numeric, 1)      as avg_portion,
  round(avg(r.vibe)::numeric, 1)         as avg_vibe,
  round(avg((r.price + r.study + r.portion + r.vibe) / 4.0)::numeric, 1) as avg_overall
from public.venues v
left join public.reviews r on r.venue_id = v.id
group by v.id;

-- Yorum akışı: yorumla birlikte yazarın sadece görünür bilgileri
-- (takma ad, avatar, üniversite kısa adı). E-posta gibi kişisel veriler
-- dışarı çıkmaz. Görünüm sahibinin yetkisiyle çalışır, bu yüzden sütunlar
-- bilinçli olarak sınırlı tutuldu.
create or replace view public.review_feed as
select
  r.id, r.venue_id, r.user_id,
  r.price, r.study, r.portion, r.vibe, r.comment,
  r.created_at, r.updated_at,
  p.display_name, p.avatar,
  u.short_name as university_short
from public.reviews r
join public.profiles p on p.id = r.user_id
left join public.universities u on u.id = p.university_id;

revoke all on public.review_feed from anon;
grant select on public.review_feed to authenticated;

-- ---------------------------------------------------------------------
-- 6. RLS — SATIR DÜZEYİ GÜVENLİK
-- ---------------------------------------------------------------------

alter table public.universities        enable row level security;
alter table public.profiles            enable row level security;
alter table public.venues              enable row level security;
alter table public.reviews             enable row level security;
alter table public.campaigns           enable row level security;
alter table public.redemptions         enable row level security;
alter table public.favorites           enable row level security;
alter table public.venue_applications  enable row level security;

-- Üniversiteler: herkes okuyabilir (kayıt ekranında liste/kontrol için)
drop policy if exists "universities_read" on public.universities;
create policy "universities_read" on public.universities
  for select to anon, authenticated using (is_active);

-- Profiller: kişi sadece kendi profilini görür ve günceller.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Kullanıcı sadece takma adını ve avatarını değiştirebilir;
-- rol, üniversite ve doğrulama tarihi uygulamadan değiştirilemez.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar) on public.profiles to authenticated;

-- Mekanlar: giriş yapmış herkes aktif mekanları görür; admin her şeyi yönetir.
drop policy if exists "venues_read" on public.venues;
create policy "venues_read" on public.venues
  for select to authenticated using (is_active or public.is_admin() or owner_id = auth.uid());

drop policy if exists "venues_admin_all" on public.venues;
create policy "venues_admin_all" on public.venues
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Yorumlar: herkes okur; sadece doğrulaması geçerli öğrenci yazar;
-- kişi sadece kendi yorumunu düzenler/siler.
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews
  for select to authenticated using (true);

drop policy if exists "reviews_insert_verified" on public.reviews;
create policy "reviews_insert_verified" on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_verified(auth.uid()));

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_verified(auth.uid()));

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Kampanyalar: herkes aktif olanları görür; mekan sahibi kendi mekanınınkileri yönetir.
drop policy if exists "campaigns_read" on public.campaigns;
create policy "campaigns_read" on public.campaigns
  for select to authenticated
  using (is_active or public.owns_venue(venue_id) or public.is_admin());

drop policy if exists "campaigns_owner_write" on public.campaigns;
create policy "campaigns_owner_write" on public.campaigns
  for all to authenticated
  using (public.owns_venue(venue_id) or public.is_admin())
  with check (public.owns_venue(venue_id) or public.is_admin());

-- Kodlar: öğrenci kendi kodlarını, mekan sahibi kendi mekanının kodlarını görür.
-- Ekleme/güncelleme sadece RPC fonksiyonları (4b, 4c) üzerinden yapılır.
drop policy if exists "redemptions_read" on public.redemptions;
create policy "redemptions_read" on public.redemptions
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and public.owns_venue(c.venue_id)
    )
  );

-- Favoriler: tamamen kişiye özel.
drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mekan başvuruları: herkes başvuru bırakabilir, sadece admin görür/günceller.
drop policy if exists "applications_insert" on public.venue_applications;
create policy "applications_insert" on public.venue_applications
  for insert to anon, authenticated with check (status = 'beklemede');

drop policy if exists "applications_admin" on public.venue_applications;
create policy "applications_admin" on public.venue_applications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- RPC yetkileri
revoke execute on function public.create_redemption(uuid)  from anon;
revoke execute on function public.redeem_code(text)        from anon;
revoke execute on function public.refresh_verification()   from anon;

-- ---------------------------------------------------------------------
-- 7. ÖRNEK VERİ
--  Mekan adları temsilidir. Gerçek mekan verisi ileride Google Places /
--  mekan başvuruları üzerinden gelecek.
-- ---------------------------------------------------------------------

insert into public.universities (id, name, short_name, domains, campus_name, lat, lng) values
  (1,  'İstanbul Arel Üniversitesi',        'Arel',       array['istanbularel.edu.tr'],                      'Tepekent Yerleşkesi',  41.0627, 28.5937),
  (2,  'İstanbul Teknik Üniversitesi',      'İTÜ',        array['itu.edu.tr'],                       'Ayazağa Yerleşkesi',   41.1055, 29.0254),
  (3,  'Boğaziçi Üniversitesi',             'Boğaziçi',   array['bogazici.edu.tr', 'boun.edu.tr'],   'Güney Kampüs',         41.0839, 29.0510),
  (4,  'Yıldız Teknik Üniversitesi',        'YTÜ',        array['yildiz.edu.tr'],                    'Davutpaşa Kampüsü',    41.0256, 28.8897),
  (5,  'Marmara Üniversitesi',              'Marmara',    array['marmara.edu.tr', 'marun.edu.tr'],   'Göztepe Kampüsü',      40.9874, 29.0570),
  (6,  'İstanbul Üniversitesi',             'İÜ',         array['istanbul.edu.tr', 'iu.edu.tr'],     'Beyazıt Kampüsü',      41.0129, 28.9637),
  (7,  'Bahçeşehir Üniversitesi',           'BAU',        array['bau.edu.tr'],                       'Beşiktaş Kampüsü',     41.0420, 29.0091),
  (8,  'İstanbul Bilgi Üniversitesi',       'Bilgi',      array['bilgi.edu.tr'],                     'santralistanbul',      41.0670, 28.9466),
  (9,  'Kadir Has Üniversitesi',            'KHAS',       array['khas.edu.tr'],                      'Cibali Kampüsü',       41.0247, 28.9590),
  (10, 'Galatasaray Üniversitesi',          'GSÜ',        array['gsu.edu.tr'],                       'Ortaköy Kampüsü',      41.0466, 29.0226),
  (11, 'Özyeğin Üniversitesi',              'Özyeğin',    array['ozyegin.edu.tr'],                   'Çekmeköy Kampüsü',     41.0306, 29.2589),
  (12, 'Koç Üniversitesi',                  'Koç',        array['ku.edu.tr'],                        'Rumelifeneri Kampüsü', 41.2050, 29.0720)
on conflict (id) do nothing;

select setval('public.universities_id_seq', (select max(id) from public.universities));

insert into public.venues (id, name, category, description, district, address, lat, lng, price_level, university_id) values
  ('00000000-0000-4000-8000-000000000101', 'Tepe Çay Ocağı',       'kafe',           'Bol prizli, sessiz köşeli çay ocağı. Sınav haftası favorisi.',      'Büyükçekmece', 'Tepekent Mah.',            41.0641, 28.5952, 1, 1),
  ('00000000-0000-4000-8000-000000000102', 'Kampüs Dürüm',         'fastfood',       'Ders arası hızlı dürüm, öğrenci menüsü var.',                      'Büyükçekmece', 'Tepekent Mah.',            41.0612, 28.5911, 1, 1),
  ('00000000-0000-4000-8000-000000000103', 'Göl Kenarı Kahve',     'kafe',           'Göl manzaralı, hafta sonu kalabalık.',                              'Büyükçekmece', 'Sahil Yolu',               41.0218, 28.5807, 2, 1),
  ('00000000-0000-4000-8000-000000000104', 'Ev Yemekleri Lokantası','restoran',      'Günlük değişen tencere yemekleri, porsiyonlar büyük.',             'Büyükçekmece', 'Mimarsinan Mah.',          41.0533, 28.6012, 1, 1),
  ('00000000-0000-4000-8000-000000000201', 'Ayazağa Kitap Kafe',   'kutuphane-kafe', 'Kitap okuma köşeleri, hızlı wifi, uzun masa.',                     'Sarıyer',      'Ayazağa Mah.',             41.1072, 29.0221, 2, 2),
  ('00000000-0000-4000-8000-000000000202', 'Maslak Burger Durağı', 'fastfood',       'Öğrenci kartına menü indirimi.',                                   'Sarıyer',      'Maslak',                   41.1101, 29.0198, 2, 2),
  ('00000000-0000-4000-8000-000000000301', 'Hisar Simit Evi',      'kafe',           'Sabah simit-çay, bahçede ders çalışılabilir.',                     'Beşiktaş',     'Rumelihisarı',             41.0851, 29.0563, 1, 3),
  ('00000000-0000-4000-8000-000000000302', 'Bebek Tatlıcısı',      'tatli',          'Sütlü tatlılar, akşamları kalabalık.',                             'Beşiktaş',     'Bebek',                    41.0773, 29.0434, 3, 3),
  ('00000000-0000-4000-8000-000000000401', 'Davutpaşa Pide',       'restoran',       'Uygun fiyatlı pide ve lahmacun.',                                  'Esenler',      'Davutpaşa Cad.',           41.0277, 28.8868, 1, 4),
  ('00000000-0000-4000-8000-000000000402', 'Etüt Kahve',           'kutuphane-kafe', 'Sessiz kat, saatlik masa yok, priz bol.',                          'Esenler',      'Davutpaşa Kampüs Karşısı', 41.0239, 28.8921, 2, 4),
  ('00000000-0000-4000-8000-000000000601', 'Beyazıt Börekçisi',    'kafe',           'Sabahları taze börek, ayakta hızlı servis.',                       'Fatih',        'Beyazıt Meydanı',          41.0107, 28.9645, 1, 6),
  ('00000000-0000-4000-8000-000000000701', 'Sahil Döner',          'fastfood',       'Kampüse 3 dakika, gece geç saate kadar açık.',                     'Beşiktaş',     'Çırağan Cad.',             41.0431, 29.0110, 2, 7)
on conflict (id) do nothing;

insert into public.campaigns (id, venue_id, title, description, discount_text, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000101', 'Sınav Haftası Çayı',  'Öğrenci kimliğiyle sınırsız çay 2 saat.',   'Sınırsız çay 30₺',  now() - interval '1 day', now() + interval '60 days'),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000102', 'Öğle Menüsü',         'Dürüm + ayran öğle saatlerinde.',           '%20 indirim',       now() - interval '1 day', now() + interval '60 days'),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000201', 'Filtre Kahve',        'Her filtre kahvede ikinci bardak bedava.',  '1 alana 1 bedava',  now() - interval '1 day', now() + interval '60 days'),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000401', 'Pide + Ayran',        'Öğrenci menüsü.',                           '%15 indirim',       now() - interval '1 day', now() + interval '60 days'),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000701', 'Gece Menüsü',         '22:00 sonrası öğrenciye özel.',             '%25 indirim',       now() - interval '1 day', now() + interval '60 days')
on conflict (id) do nothing;

-- =====================================================================
-- İlk admin hesabı (isteğe bağlı): kendi edu hesabınla kayıt olduktan sonra
--   update public.profiles set role = 'admin' where email = 'senin@arel.edu.tr';
-- =====================================================================
