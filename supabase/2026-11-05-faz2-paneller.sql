-- =====================================================================
--  UĞRAK — Faz 2 veritabanı güncellemesi (2026-11-05)
--  Mekan paneli ve admin paneli gerçek veriye bağlanıyor.
--   1) Mekan sahibi hesabı: admin davetiyle .edu dışı e-posta
--   2) Mekan sahibi öğrenci sayılmaz (puan veremez, kod alamaz)
--   3) Mekan başvurusu kararı (not, karar veren, açılan mekan)
--   4) Mekan bilgileri: alan sınırları, İstanbul dışı koordinat reddi
--   5) Kampanya kuralları (süre, sayı, değiştirilemeyen alanlar)
--   6) Kod doğrulama: anlaşılır sonuç + tahmin denemelerine sınır
--   7) Panel fonksiyonları (mekanlarım, favori sayısı, admin listeleri,
--      yorum gizleme)
--   8) Son kilit: fonksiyon yetkileri
--
--  Nasıl çalıştırılır: Supabase → SQL Editor → New query → bu dosyanın
--  tamamını yapıştır → Run. Önce schema.sql, 2026-11-03 ve 2026-11-04
--  dosyaları çalışmış olmalı. Dosya tekrar çalıştırılabilir.
--  Erişim kuralları supabase/tests/erisim-testi.mjs ile test edilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MEKAN SAHİBİ DAVETİ
--    Admin bir başvuruyu onaylayınca sunucu fonksiyonu (Edge Function)
--    önce buraya 15 dakika geçerli bir davet yazar, sonra hesabı açar.
--    Kayıt tetikleyicisi .edu olmayan bir adresi SADECE geçerli bir davet
--    varsa kabul eder. Tabloya uygulamadan hiç kimse erişemez.
-- ---------------------------------------------------------------------

create table if not exists public.owner_invites (
  email         text primary key check (email = lower(email) and email like '%@%.%'),
  display_name  text not null check (char_length(display_name) between 1 and 24),
  created_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz not null,
  used_at       timestamptz
);
alter table public.owner_invites enable row level security;
revoke all on public.owner_invites from public, anon, authenticated;

create or replace function public.has_owner_invite(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.owner_invites
    where email = lower(btrim(p_email)) and used_at is null and expires_at > now()
  );
$$;

-- Kayıt öncesi: edu adresi ya da geçerli mekan sahibi daveti
create or replace function public.check_edu_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.university_for_email(new.email) is null and not public.has_owner_invite(new.email) then
    raise exception 'UGRAK_DOMAIN: Bu e-posta adresi desteklenen bir İstanbul üniversitesine ait değil.';
  end if;
  return new;
end;
$$;

-- Kayıt sonrası profil: davetliyse mekan sahibi, değilse öğrenci
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 24);
  v_invite public.owner_invites;
begin
  select * into v_invite from public.owner_invites
  where email = lower(new.email) and used_at is null and expires_at > now()
  for update;

  if found then
    insert into public.profiles (id, email, display_name, university_id, role, verified_at, kvkk_accepted_at)
    values (new.id, lower(new.email), v_invite.display_name, null, 'venue_owner', null, null)
    on conflict (id) do nothing;
    update public.owner_invites set used_at = now() where email = v_invite.email;
    return new;
  end if;

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
-- 2. MEKAN SAHİBİ ÖĞRENCİ SAYILMAZ
--    E-postası .edu olsa ya da şifre linkiyle e-postasını doğrulasa bile
--    puan veremez, kampanya kodu alamaz.
-- ---------------------------------------------------------------------

create or replace function public.is_verified(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select verified_at > now() - interval '1 year' and role <> 'venue_owner'
     from public.profiles where id = p_uid),
    false
  );
$$;

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at <> new.email_confirmed_at) then
    update public.profiles set verified_at = new.email_confirmed_at
    where id = new.id and role <> 'venue_owner';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. MEKAN BAŞVURUSU KARARI
-- ---------------------------------------------------------------------

alter table public.venue_applications add column if not exists venue_id    uuid references public.venues (id) on delete set null;
alter table public.venue_applications add column if not exists admin_note  text;
alter table public.venue_applications add column if not exists decided_at  timestamptz;
alter table public.venue_applications add column if not exists decided_by  uuid references public.profiles (id) on delete set null;
alter table public.venue_applications drop constraint if exists venue_applications_note_len;
alter table public.venue_applications add constraint venue_applications_note_len
  check (admin_note is null or char_length(admin_note) <= 500);

-- "Onaylandı" sadece gerçekten mekan açılınca verilir; onay geri alınamaz.
create or replace function public.guard_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'onaylandi' and new.status <> 'onaylandi' then
    raise exception 'UGRAK_APP_STATE: Onaylanmış başvurunun durumu değiştirilemez.';
  end if;
  if new.status = 'onaylandi' and old.status <> 'onaylandi' and new.venue_id is null then
    raise exception 'UGRAK_APP_STATE: Başvuru, mekan ve sahip hesabı açılarak onaylanır (Onayla butonu).';
  end if;
  if new.status is distinct from old.status then
    new.decided_at := now();
    new.decided_by := coalesce(auth.uid(), new.decided_by);
  end if;
  return new;
end;
$$;

drop trigger if exists venue_applications_guard on public.venue_applications;
create trigger venue_applications_guard
  before update on public.venue_applications
  for each row execute function public.guard_application_status();

-- Admin uygulamadan sadece durum ve not değiştirebilir (RLS: sadece admin)
revoke update on public.venue_applications from authenticated;
grant update (status, admin_note) on public.venue_applications to authenticated;
revoke delete on public.venue_applications from authenticated;

-- ---------------------------------------------------------------------
-- 4. MEKAN BİLGİLERİ
-- ---------------------------------------------------------------------

alter table public.venues drop constraint if exists venues_fields;
alter table public.venues add constraint venues_fields check (
  char_length(btrim(name)) between 2 and 80
  and char_length(btrim(district)) between 2 and 40
  and (address is null or char_length(address) <= 160)
  and (description is null or char_length(description) <= 300)
  -- İstanbul il sınırları (yaklaşık)
  and lat between 40.80 and 41.60
  and lng between 27.90 and 29.95
);

-- Admin mekan bilgilerini düzenler; sahibi sadece sunucu fonksiyonu atar.
-- Mekan silinmez (yorumlar ve kod geçmişi kaybolmasın), kapatılır.
revoke insert, update, delete on public.venues from authenticated;
grant insert (name, category, description, district, address, lat, lng, price_level, university_id, is_active)
  on public.venues to authenticated;
grant update (name, category, description, district, address, lat, lng, price_level, university_id, is_active)
  on public.venues to authenticated;

-- ---------------------------------------------------------------------
-- 5. KAMPANYA KURALLARI
--    - Mekan sahibi kampanya silemez (öğrencilerin kod geçmişi kalır),
--      durdurur ya da bitiş tarihini değiştirir.
--    - En fazla 90 gün, en fazla 30 gün sonra başlar, kapalı mekana açılmaz.
--    - Bir mekanda aynı anda en fazla 3 yürürlükteki kampanya.
--    - Başladıktan sonra başlık / indirim metni değiştirilemez
--      (kodu alan öğrenci yanıltılmasın).
--    Kurallar uygulamadan (oturum açmış kullanıcıdan) gelen değişikliklere
--    uygulanır; SQL Editor'den yapılan bakım işlerine uygulanmaz.
-- ---------------------------------------------------------------------

alter table public.campaigns drop constraint if exists campaigns_fields;
alter table public.campaigns add constraint campaigns_fields check (
  char_length(btrim(title)) between 2 and 60
  and char_length(btrim(discount_text)) between 1 and 40
  and (description is null or char_length(description) <= 200)
);

create or replace function public.validate_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live int;
begin
  if auth.uid() is null then
    return new;  -- bakım (SQL Editor / servis)
  end if;

  if tg_op = 'UPDATE' then
    if new.venue_id <> old.venue_id then
      raise exception 'UGRAK_CAMPAIGN: Kampanya başka mekana taşınamaz.';
    end if;
    if old.starts_at <= now() and (
         new.title is distinct from old.title
      or new.discount_text is distinct from old.discount_text
      or new.description is distinct from old.description
      or new.starts_at is distinct from old.starts_at) then
      raise exception 'UGRAK_CAMPAIGN: Başlamış kampanyanın başlığı ve indirimi değiştirilemez. Durdurup yenisini açabilirsin.';
    end if;
  end if;

  if new.ends_at <= new.starts_at then
    raise exception 'UGRAK_CAMPAIGN: Bitiş, başlangıçtan sonra olmalı.';
  end if;
  if new.ends_at > new.starts_at + interval '90 days' then
    raise exception 'UGRAK_CAMPAIGN: Bir kampanya en fazla 90 gün sürebilir.';
  end if;

  -- Yeni açılan ya da yeniden başlatılan kampanya
  if tg_op = 'INSERT' or (new.is_active and not old.is_active) or new.ends_at <> old.ends_at then
    if new.ends_at <= now() then
      raise exception 'UGRAK_CAMPAIGN: Bitiş tarihi geçmişte olamaz.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.starts_at < now() - interval '10 minutes' then
      raise exception 'UGRAK_CAMPAIGN: Başlangıç geçmişte olamaz.';
    end if;
    if new.starts_at > now() + interval '30 days' then
      raise exception 'UGRAK_CAMPAIGN: Kampanya en fazla 30 gün sonrasına planlanabilir.';
    end if;
  end if;

  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    if not exists (select 1 from public.venues where id = new.venue_id and is_active) then
      raise exception 'UGRAK_CAMPAIGN: Mekan kapalıyken kampanya açılamaz.';
    end if;
    select count(*) into v_live from public.campaigns
    where venue_id = new.venue_id and is_active and ends_at > now()
      and (tg_op = 'INSERT' or id <> new.id);
    if v_live >= 3 then
      raise exception 'UGRAK_CAMPAIGN: Aynı anda en fazla 3 kampanya yürürlükte olabilir. Önce birini durdur.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_validate on public.campaigns;
create trigger campaigns_validate
  before insert or update on public.campaigns
  for each row execute function public.validate_campaign();

revoke insert, update, delete on public.campaigns from authenticated;
grant insert (venue_id, title, description, discount_text, starts_at, ends_at) on public.campaigns to authenticated;
grant update (title, description, discount_text, starts_at, ends_at, is_active) on public.campaigns to authenticated;

-- ---------------------------------------------------------------------
-- 6. KOD DOĞRULAMA
--    Sonuç hata yerine açıklama olarak döner; böylece hatalı denemeler
--    kaydedilir. Bir mekan hesabı 10 dakikada 20 hatalı denemeden sonra
--    bekletilir (6 haneli kodu tahmin etmeye karşı).
--    Okutulan QR "UGRAK:KOD" biçiminde; boşluk, tire ve küçük harf tolere edilir.
-- ---------------------------------------------------------------------

create table if not exists public.redeem_attempts (
  id        bigserial primary key,
  owner_id  uuid not null references public.profiles (id) on delete cascade,
  at        timestamptz not null default now(),
  ok        boolean not null
);
create index if not exists redeem_attempts_owner_idx on public.redeem_attempts (owner_id, at);
alter table public.redeem_attempts enable row level security;
revoke all on public.redeem_attempts from public, anon, authenticated;

drop function if exists public.redeem_code(text);
create function public.redeem_code(p_code text)
returns table (ok boolean, reason text, campaign_title text, used_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_fails int;
  v_id uuid;
  v_used timestamptz;
  v_expires timestamptz;
  v_title text;
  v_camp_active boolean;
  v_venue_active boolean;
begin
  if v_uid is null then
    raise exception 'UGRAK_AUTH: Oturum yok.';
  end if;
  if not exists (select 1 from public.venues where owner_id = v_uid) then
    raise exception 'UGRAK_OWNER: Kod doğrulamak için mekan hesabıyla giriş yapmalısın.';
  end if;

  delete from public.redeem_attempts where owner_id = v_uid and at < now() - interval '1 day';
  select count(*) into v_fails from public.redeem_attempts
  where owner_id = v_uid and not redeem_attempts.ok and at > now() - interval '10 minutes';
  if v_fails >= 20 then
    return query select false, 'LIMIT'::text, null::text, null::timestamptz;
    return;
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_code like 'UGRAK%' and length(v_code) = 11 then
    v_code := substr(v_code, 6);
  end if;
  if length(v_code) <> 6 then
    insert into public.redeem_attempts (owner_id, ok) values (v_uid, false);
    return query select false, 'FORMAT'::text, null::text, null::timestamptz;
    return;
  end if;

  select r.id, r.used_at, r.expires_at, c.title, c.is_active, v.is_active
    into v_id, v_used, v_expires, v_title, v_camp_active, v_venue_active
  from public.redemptions r
  join public.campaigns c on c.id = r.campaign_id
  join public.venues v on v.id = c.venue_id
  where r.code = v_code and v.owner_id = v_uid
  for update of r;

  if v_id is null then
    insert into public.redeem_attempts (owner_id, ok) values (v_uid, false);
    return query select false, 'NOT_FOUND'::text, null::text, null::timestamptz;
    return;
  end if;
  if v_used is not null then
    insert into public.redeem_attempts (owner_id, ok) values (v_uid, false);
    return query select false, 'USED'::text, v_title, v_used;
    return;
  end if;
  if v_expires < now() then
    insert into public.redeem_attempts (owner_id, ok) values (v_uid, false);
    return query select false, 'EXPIRED'::text, v_title, null::timestamptz;
    return;
  end if;
  if not v_camp_active or not v_venue_active then
    insert into public.redeem_attempts (owner_id, ok) values (v_uid, false);
    return query select false, 'STOPPED'::text, v_title, null::timestamptz;
    return;
  end if;

  update public.redemptions set used_at = now() where id = v_id returning redemptions.used_at into v_used;
  insert into public.redeem_attempts (owner_id, ok) values (v_uid, true);
  return query select true, 'OK'::text, v_title, v_used;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. PANEL FONKSİYONLARI
-- ---------------------------------------------------------------------

-- Mekan sahibinin kendi mekanları (kapalı olanlar dahil)
create or replace function public.my_venues()
returns table (
  id uuid, name text, category text, description text, district text, address text,
  lat double precision, lng double precision, price_level smallint, is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.name, v.category, v.description, v.district, v.address, v.lat, v.lng, v.price_level, v.is_active
  from public.venues v
  where v.owner_id = auth.uid()
  order by v.name;
$$;

-- Bir mekanı favoriye ekleyen kişi sayısı (kimlik yok; sadece sahibi ve admin)
create or replace function public.venue_favorite_count(p_venue uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.owns_venue(p_venue) or public.is_admin()) then
    raise exception 'UGRAK_FORBIDDEN: Bu mekanın verisine erişimin yok.';
  end if;
  return (select count(*)::int from public.favorites where venue_id = p_venue);
end;
$$;

-- Admin: tüm mekanlar + sahip durumu (sahip şifresini belirleyip giriş yaptı mı?)
create or replace function public.admin_venues()
returns table (
  id uuid, name text, category text, description text, district text, address text,
  lat double precision, lng double precision, price_level smallint, is_active boolean,
  owner_email text, owner_name text, owner_joined boolean, live_campaigns int, review_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'UGRAK_FORBIDDEN: Sadece admin.';
  end if;
  return query
  select v.id, v.name, v.category, v.description, v.district, v.address, v.lat, v.lng, v.price_level, v.is_active,
         p.email, p.display_name, (u.last_sign_in_at is not null),
         (select count(*)::int from public.campaigns c where c.venue_id = v.id and c.is_active and c.ends_at > now()),
         (select count(*)::int from public.reviews r where r.venue_id = v.id and r.hidden_at is null)
  from public.venues v
  left join public.profiles p on p.id = v.owner_id
  left join auth.users u on u.id = v.owner_id
  order by v.is_active desc, v.name;
end;
$$;

-- Admin: mekanın sahibini kaldır (ör. yanlış e-posta). Hesap silinmez.
create or replace function public.admin_detach_owner(p_venue uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'UGRAK_FORBIDDEN: Sadece admin.';
  end if;
  update public.venues set owner_id = null where id = p_venue;
end;
$$;

-- Admin: yorum denetimi listesi
create or replace function public.admin_reviews(p_only_hidden boolean default false, p_limit int default 100)
returns table (
  id uuid, venue_id uuid, venue_name text, display_name text,
  price smallint, study smallint, portion smallint, vibe smallint,
  comment text, updated_at timestamptz, hidden_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'UGRAK_FORBIDDEN: Sadece admin.';
  end if;
  return query
  select r.id, r.venue_id, v.name, p.display_name, r.price, r.study, r.portion, r.vibe,
         r.comment, r.updated_at, r.hidden_at
  from public.reviews r
  join public.venues v on v.id = r.venue_id
  join public.profiles p on p.id = r.user_id
  where (not p_only_hidden or r.hidden_at is not null)
  order by r.updated_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Admin: yorumu gizle / geri aç
create or replace function public.admin_set_review_hidden(p_review uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'UGRAK_FORBIDDEN: Sadece admin.';
  end if;
  update public.reviews
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end
  where id = p_review;
  if not found then
    raise exception 'UGRAK_NOT_FOUND: Yorum bulunamadı.';
  end if;
end;
$$;

-- ---- Sunucu fonksiyonu (Edge Function) için: sadece service_role ----
-- p_admin: Edge Function'ın oturum anahtarından doğruladığı admin kimliği.
-- Burada bir kez daha kontrol edilir.

-- Sahip hesabını hazırla: varsa mevcut mekan sahibinin kimliğini döner,
-- yoksa davet yazar ve null döner (hesabı Edge Function açar).
create or replace function public.admin_prepare_owner(p_admin uuid, p_email text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := left(btrim(coalesce(p_name, '')), 24);
  v_profile public.profiles;
begin
  if not exists (select 1 from public.profiles where id = p_admin and role = 'admin') then
    raise exception 'UGRAK_FORBIDDEN: Sadece admin.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'UGRAK_OWNER_EMAIL: Geçerli bir e-posta adresi gir.';
  end if;
  if char_length(v_name) < 1 then
    raise exception 'UGRAK_OWNER_NAME: Sahibin adını gir.';
  end if;

  select * into v_profile from public.profiles where email = v_email;
  if found then
    if v_profile.role = 'venue_owner' then
      return v_profile.id;
    end if;
    raise exception 'UGRAK_OWNER_EMAIL: Bu e-posta bir öğrenci ya da admin hesabına ait. Mekan için işletme e-postası kullanılmalı.';
  end if;

  insert into public.owner_invites (email, display_name, created_by, expires_at, used_at)
  values (v_email, v_name, p_admin, now() + interval '15 minutes', null)
  on conflict (email) do update
    set display_name = excluded.display_name, created_by = excluded.created_by,
        expires_at = excluded.expires_at, used_at = null;
  return null;
end;
$$;

-- Mekanı aç (ya da mevcut mekana sahip ata) ve başvuruyu onayla. Tek işlem:
-- iki admin aynı başvuruyu aynı anda onaylarsa ikincisi hata alır.
create or replace function public.admin_attach_venue(
  p_admin uuid, p_owner uuid, p_application uuid, p_venue uuid, p_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_venue uuid := p_venue;
begin
  if not exists (select 1 from public.profiles where id = p_admin and role = 'admin') then
    raise exception 'UGRAK_FORBIDDEN: Sadece admin.';
  end if;
  if not exists (select 1 from public.profiles where id = p_owner and role = 'venue_owner') then
    raise exception 'UGRAK_OWNER: Sahip hesabı bulunamadı.';
  end if;

  if p_application is not null then
    select status into v_status from public.venue_applications where id = p_application for update;
    if v_status is null then
      raise exception 'UGRAK_APP: Başvuru bulunamadı.';
    end if;
    if v_status in ('onaylandi', 'reddedildi') then
      raise exception 'UGRAK_APP_STATE: Bu başvuru zaten sonuçlanmış.';
    end if;
  end if;

  if v_venue is null then
    insert into public.venues (name, category, description, district, address, lat, lng, price_level, is_active, owner_id)
    values (
      btrim(p_data ->> 'name'),
      p_data ->> 'category',
      nullif(btrim(coalesce(p_data ->> 'description', '')), ''),
      btrim(p_data ->> 'district'),
      nullif(btrim(coalesce(p_data ->> 'address', '')), ''),
      (p_data ->> 'lat')::double precision,
      (p_data ->> 'lng')::double precision,
      (p_data ->> 'price_level')::smallint,
      true,
      p_owner
    )
    returning id into v_venue;
  else
    update public.venues set owner_id = p_owner where id = v_venue;
    if not found then
      raise exception 'UGRAK_VENUE: Mekan bulunamadı.';
    end if;
  end if;

  if p_application is not null then
    update public.venue_applications
    set venue_id = v_venue, status = 'onaylandi', decided_by = p_admin
    where id = p_application;
  end if;
  return v_venue;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. SON KİLİT: fonksiyon yetkileri (Faz 1'deki gibi en sonda sıfırla)
-- ---------------------------------------------------------------------
alter default privileges revoke execute on functions from public;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.am_i_verified()                         to authenticated;
grant execute on function public.is_admin()                              to authenticated;
grant execute on function public.owns_venue(uuid)                        to authenticated;
grant execute on function public.create_redemption(uuid)                 to authenticated;
grant execute on function public.refresh_verification()                  to authenticated;
grant execute on function public.redeem_code(text)                       to authenticated;
grant execute on function public.my_venues()                             to authenticated;
grant execute on function public.venue_favorite_count(uuid)              to authenticated;
grant execute on function public.admin_venues()                          to authenticated;
grant execute on function public.admin_detach_owner(uuid)                to authenticated;
grant execute on function public.admin_reviews(boolean, int)             to authenticated;
grant execute on function public.admin_set_review_hidden(uuid, boolean)  to authenticated;

revoke execute on function public.admin_prepare_owner(uuid, text, text)            from service_role;
revoke execute on function public.admin_attach_venue(uuid, uuid, uuid, uuid, jsonb) from service_role;
grant execute on function public.admin_prepare_owner(uuid, text, text)            to service_role;
grant execute on function public.admin_attach_venue(uuid, uuid, uuid, uuid, jsonb) to service_role;

-- Kontrol: misafirin çalıştırabildiği fonksiyon olmamalı (boş dönmeli)
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
