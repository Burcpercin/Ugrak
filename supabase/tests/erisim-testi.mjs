// =====================================================================
//  UĞRAK — Veritabanı erişim testi
//  Çalıştırma: npm run test:db
//
//  Bellekte gerçek bir PostgreSQL (PGlite) açar, Supabase'in rollerini
//  (anon = misafir, authenticated = giriş yapmış) taklit eder, şemayı ve
//  güncellemeleri sırayla kurar, sonra her rol için "yapabilmeli /
//  yapamamalı" kurallarını tek tek dener. Bir kural bozulursa test kırmızı
//  biter (çıkış kodu 1).
// =====================================================================
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQL_FILES = [
  'schema.sql',
  '2026-11-03-arel-alan-adi.sql',
  '2026-11-04-faz1-guvenlik-misafir-kampus.sql',
];

const db = new PGlite();

// --- Supabase ortamını taklit et -------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}',
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
  grant usage on schema auth, public to anon, authenticated;
  -- Supabase, public şemasında oluşturulan her yeni nesneye anon/authenticated
  -- için varsayılan olarak tam yetki verir; şema dosyaları bunun üstüne kurulur.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

for (const f of SQL_FILES) {
  let sql = fs.readFileSync(path.join(dir, f), 'utf8');
  if (f === 'schema.sql') sql = sql.replace('create extension if not exists pgcrypto;', '');
  await db.exec(sql);
}

// --- Test kullanıcıları ----------------------------------------------
const U = {
  ali: '11111111-1111-4111-8111-111111111111', // doğrulanmış öğrenci
  ayse: '22222222-2222-4222-8222-222222222222', // doğrulanmış öğrenci
  eski: '33333333-3333-4333-8333-333333333333', // doğrulaması dolmuş
  mekan: '44444444-4444-4444-8444-444444444444', // mekan sahibi
  admin: '55555555-5555-4555-8555-555555555555', // admin
};
const V1 = '00000000-0000-4000-8000-000000000101'; // Tepe Çay Ocağı
const V2 = '00000000-0000-4000-8000-000000000102'; // Kampüs Dürüm
const C1 = '00000000-0000-4000-8000-000000001001'; // V1 kampanyası
const C2 = '00000000-0000-4000-8000-000000001002'; // V2 kampanyası

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
    ('${U.ali}',   'ali@istanbularel.edu.tr',   '{"display_name":"Ali","kvkk_accepted":"true"}', now()),
    ('${U.ayse}',  'ayse@itu.edu.tr',           '{"display_name":"Ayşe","kvkk_accepted":"true"}', now()),
    ('${U.eski}',  'eski@yildiz.edu.tr',        '{"display_name":"Eski","kvkk_accepted":"true"}', now()),
    ('${U.mekan}', 'mekan@istanbularel.edu.tr', '{"display_name":"Mekan"}', now()),
    ('${U.admin}', 'admin@istanbularel.edu.tr', '{"display_name":"Admin"}', now());
  update public.profiles set verified_at = now() - interval '13 months' where id = '${U.eski}';
  update public.profiles set role = 'venue_owner' where id = '${U.mekan}';
  update public.profiles set role = 'admin' where id = '${U.admin}';
  update public.venues set owner_id = '${U.mekan}' where id = '${V1}';
  insert into public.venues (id, name, category, district, lat, lng, price_level, is_active)
    values ('00000000-0000-4000-8000-0000000009ff', 'Kapalı Mekan', 'kafe', 'Fatih', 41.0, 28.9, 1, false);
  insert into public.campaigns (id, venue_id, title, discount_text, starts_at, ends_at, is_active)
    values ('00000000-0000-4000-8000-0000000019ff', '${V2}', 'Bitmiş', '%5', now() - interval '10 days', now() - interval '1 day', true);
  insert into public.reviews (user_id, venue_id, price, study, portion, vibe, comment)
    values ('${U.ayse}', '${V1}', 4, 4, 4, 4, 'Ayşe yorumu');
`);

// --- Yardımcılar -----------------------------------------------------
async function as(who, { amr } = {}) {
  await db.exec('reset role');
  const jwt = amr ? JSON.stringify({ amr: [{ method: amr, timestamp: Math.floor(Date.now() / 1000) }] }) : '';
  await db.exec(`select set_config('test.uid', '${who === 'anon' ? '' : U[who]}', false)`);
  await db.exec(`select set_config('test.jwt', '${jwt}', false)`);
  await db.exec(`set role ${who === 'anon' ? 'anon' : 'authenticated'}`);
}

async function run(sql) {
  try {
    const r = await db.query(sql);
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const results = [];
function check(role, name, pass, detail = '') {
  results.push({ role, name, pass, detail });
}

// Beklenti: izin verilmeli (hata yok, isteğe bağlı satır kontrolü)
async function allow(role, name, sql, rowCheck) {
  const r = await run(sql);
  const pass = r.ok && (!rowCheck || rowCheck(r));
  check(role, name, pass, r.ok ? (rowCheck && !pass ? `satır: ${JSON.stringify(r.rows).slice(0, 120)}` : '') : r.error);
  return r;
}

// Beklenti: engellenmeli (hata ya da hiçbir satır etkilenmemeli)
async function deny(role, name, sql) {
  const r = await run(sql);
  const blocked = !r.ok || ((r.rows?.length ?? 0) === 0 && (r.affected ?? 0) === 0);
  check(role, name, blocked, blocked ? '' : `beklenmedik şekilde çalıştı: ${JSON.stringify(r.rows).slice(0, 120)}`);
  return r;
}

const ONE = (r) => r.rows.length === 1;
const SOME = (r) => r.rows.length > 0;

// =====================================================================
// MİSAFİR (giriş yapmamış)
// =====================================================================
await as('anon');
await allow('misafir', 'aktif mekanları görür', `select id, name from venues`, (r) => r.rows.length === 12);
await deny('misafir', 'kapalı mekanı görmez', `select id from venues where is_active = false`);
await deny('misafir', 'mekan sahibinin kimliğini (owner_id) okuyamaz', `select owner_id from venues`);
await allow('misafir', 'aktif kampanyaları görür', `select id from campaigns`, (r) => r.rows.length === 5);
await allow('misafir', 'puan ortalamalarını görür', `select * from venue_stats`, SOME);
await allow('misafir', 'yorum akışını görür', `select * from review_feed`, SOME);
await deny('misafir', 'yorum akışında yazar kimliği yok', `select user_id from review_feed`);
await allow('misafir', 'üniversiteleri ve kampüsleri görür', `select id from campuses`, (r) => r.rows.length >= 12);
await deny('misafir', 'yorum tablosunu doğrudan okuyamaz', `select * from reviews`);
await deny('misafir', 'profilleri okuyamaz', `select * from profiles`);
await deny('misafir', 'kampanya kodlarını okuyamaz', `select * from redemptions`);
await deny('misafir', 'favori tablosunu okuyamaz', `select * from favorites`);
await deny('misafir', 'yorum yazamaz', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.ali}', '${V2}', 5,5,5,5)`);
await deny('misafir', 'kampanya kodu alamaz', `select * from create_redemption('${C1}')`);
await deny('misafir', 'kod kullanamaz', `select * from redeem_code('ABCDEF')`);
await deny('misafir', 'başkasının doğrulama durumunu sorgulayamaz', `select is_verified('${U.ali}')`);
await deny('misafir', 'yıllık doğrulamayı çağıramaz', `select refresh_verification()`);
await deny('misafir', 'e-posta → üniversite fonksiyonunu çağıramaz', `select university_for_email('x@itu.edu.tr')`);
await deny('misafir', 'mekan bilgisini değiştiremez', `update venues set name = 'x'`);
await deny('misafir', 'kampanya ekleyemez', `insert into campaigns (venue_id, title, discount_text, ends_at) values ('${V1}', 'x', 'x', now() + interval '1 day')`);
await allow('misafir', 'mekan başvurusu bırakabilir', `insert into venue_applications (venue_name, contact_name, phone, email) values ('Yeni Kafe', 'Veli', '05320000000', 'veli@ornek.com')`);
await deny('misafir', 'aynı telefonla 24 saatte ikinci başvuru yapamaz', `insert into venue_applications (venue_name, contact_name, phone, email) values ('Yeni Kafe 2', 'Veli', '05320000000', 'baska@ornek.com')`);
await deny('misafir', 'başvurunun durumunu kendisi "onaylandı" yapamaz', `insert into venue_applications (venue_name, contact_name, phone, email, status) values ('Hileli', 'Can', '05329999999', 'can@ornek.com', 'onaylandi')`);
await deny('misafir', 'çok uzun başvuru metni kabul edilmez', `insert into venue_applications (venue_name, contact_name, phone, email, note) values ('Kafe', 'Ece', '05321111111', 'ece@ornek.com', repeat('a', 900))`);
await deny('misafir', 'başvuruları okuyamaz', `select * from venue_applications`);
{
  const r = await run(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')`);
  check('misafir', 'çalıştırabildiği hiçbir fonksiyon yok', r.ok && r.rows.length === 0, r.ok ? r.rows.map((x) => x.proname).join(', ') : r.error);
}

// =====================================================================
// DOĞRULANMIŞ ÖĞRENCİ (Ali)
// =====================================================================
await as('ali');
await allow('öğrenci', 'sadece kendi profilini görür', `select id from profiles`, (r) => r.rows.length === 1 && r.rows[0].id === U.ali);
await allow('öğrenci', 'takma adını değiştirebilir', `update profiles set display_name = 'Ali K' where id = '${U.ali}' returning id`, ONE);
await deny('öğrenci', 'kendini admin yapamaz', `update profiles set role = 'admin' where id = '${U.ali}' returning id`);
await deny('öğrenci', 'doğrulama tarihini değiştiremez', `update profiles set verified_at = now() + interval '10 years' where id = '${U.ali}' returning id`);
await deny('öğrenci', 'başkasının profilini değiştiremez', `update profiles set display_name = 'x' where id = '${U.ayse}' returning id`);
await deny('öğrenci', '25 karakterden uzun takma ad kabul edilmez', `update profiles set display_name = repeat('a', 30) where id = '${U.ali}' returning id`);
await deny('öğrenci', 'çok büyük avatar verisi kabul edilmez', `update profiles set avatar = jsonb_build_object('x', repeat('a', 2000)) where id = '${U.ali}' returning id`);
await allow('öğrenci', 'mekana puan verebilir', `insert into reviews (user_id, venue_id, price, study, portion, vibe, comment) values ('${U.ali}', '${V2}', 5, 4, 3, 5, 'iyi') returning id`, ONE);
await deny('öğrenci', 'aynı mekana ikinci kez puan veremez', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.ali}', '${V2}', 1, 1, 1, 1) returning id`);
await deny('öğrenci', 'başkası adına puan veremez', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.ayse}', '${V2}', 1, 1, 1, 1) returning id`);
await deny('öğrenci', 'kapalı mekana puan veremez', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.ali}', '00000000-0000-4000-8000-0000000009ff', 1, 1, 1, 1) returning id`);
await deny('öğrenci', '1-5 dışında puan veremez', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.ali}', '${V1}', 9, 1, 1, 1) returning id`);
await allow('öğrenci', 'kendi puanını güncelleyebilir', `update reviews set price = 3 where user_id = '${U.ali}' and venue_id = '${V2}' returning id`, ONE);
await deny('öğrenci', 'yorumunu başka mekana taşıyamaz', `update reviews set venue_id = '${V1}' where user_id = '${U.ali}' returning id`);
await deny('öğrenci', 'başkasının yorumunu değiştiremez', `update reviews set price = 1 where user_id = '${U.ayse}' returning id`);
await allow('öğrenci', 'kendi yorumunu silebilir', `delete from reviews where user_id = '${U.ali}' and venue_id = '${V2}' returning id`, ONE);
await allow('öğrenci', 'silinen yorumu tekrar yazabilir', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.ali}', '${V2}', 5, 4, 3, 5) returning id`, ONE);
await deny('öğrenci', 'başkasının yorumunu silemez', `delete from reviews where user_id = '${U.ayse}' returning id`);
await allow('öğrenci', 'yorum tablosunda sadece kendi yorumunu görür', `select user_id from reviews`, (r) => r.rows.every((x) => x.user_id === U.ali));
await allow('öğrenci', 'yorum akışında kendi yorumu "is_mine"', `select is_mine from review_feed where venue_id = '${V2}'`, (r) => r.rows.length === 1 && r.rows[0].is_mine === true);
await allow('öğrenci', '"yorumlarım" görünümü sadece kendisini gösterir', `select * from my_reviews`, ONE);
await allow('öğrenci', 'kendi doğrulama durumunu öğrenir', `select am_i_verified() as v`, (r) => r.rows[0].v === true);
await deny('öğrenci', 'başkasının doğrulama durumunu sorgulayamaz', `select is_verified('${U.ayse}')`);
const red = await allow('öğrenci', 'aktif kampanya için kod alır', `select code from create_redemption('${C1}')`, ONE);
await deny('öğrenci', 'bitmiş kampanya için kod alamaz', `select code from create_redemption('00000000-0000-4000-8000-0000000019ff')`);
await allow('öğrenci', 'sadece kendi kodlarını görür', `select user_id from redemptions`, (r) => r.rows.length === 1 && r.rows[0].user_id === U.ali);
await deny('öğrenci', 'kod tablosuna elle kod ekleyemez', `insert into redemptions (campaign_id, user_id, code, expires_at) values ('${C1}', '${U.ali}', 'HACK01', now() + interval '1 year') returning id`);
await deny('öğrenci', 'kodunun süresini uzatamaz', `update redemptions set expires_at = now() + interval '1 year' returning id`);
await deny('öğrenci', 'mekan sahibi değilken kod kullanamaz', `select * from redeem_code('${red.rows?.[0]?.code ?? 'XXXXXX'}')`);
await deny('öğrenci', 'mekan kod görünümünde hiçbir şey görmez', `select * from venue_redemptions`);
await allow('öğrenci', 'favori ekleyebilir', `insert into favorites (user_id, venue_id) values ('${U.ali}', '${V1}') returning venue_id`, ONE);
await deny('öğrenci', 'başkası adına favori ekleyemez', `insert into favorites (user_id, venue_id) values ('${U.ayse}', '${V1}') returning venue_id`);
await deny('öğrenci', 'kampanya ekleyemez', `insert into campaigns (venue_id, title, discount_text, ends_at) values ('${V1}', 'x', 'x', now() + interval '1 day') returning id`);
await deny('öğrenci', 'mekan başvurularını okuyamaz', `select * from venue_applications`);
await deny('öğrenci', 'mekan sahibinin kimliğini okuyamaz', `select owner_id from venues`);

// =====================================================================
// DOĞRULAMASI DOLMUŞ ÖĞRENCİ
// =====================================================================
await as('eski');
await deny('dolmuş', 'puan veremez', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.eski}', '${V1}', 5, 5, 5, 5) returning id`);
await deny('dolmuş', 'kampanya kodu alamaz', `select code from create_redemption('${C1}')`);
await deny('dolmuş', 'şifreyle girip doğrulamayı yenileyemez', `select refresh_verification()`);
await as('eski', { amr: 'password' });
await deny('dolmuş', 'şifre oturumuyla yenileyemez', `select refresh_verification()`);
await as('eski', { amr: 'otp' });
await allow('dolmuş', 'okul mailine gelen kod/link ile yenileyebilir', `select refresh_verification() as t`, ONE);
await allow('dolmuş', 'yeniledikten sonra puan verebilir', `insert into reviews (user_id, venue_id, price, study, portion, vibe) values ('${U.eski}', '${V1}', 5, 5, 5, 5) returning id`, ONE);

// =====================================================================
// MEKAN SAHİBİ (Tepe Çay Ocağı)
// =====================================================================
await as('mekan');
await allow('mekan', 'kendi mekanına kampanya ekleyebilir', `insert into campaigns (venue_id, title, discount_text, ends_at) values ('${V1}', 'Yeni', '%10', now() + interval '7 days') returning id`, ONE);
await deny('mekan', 'başka mekana kampanya ekleyemez', `insert into campaigns (venue_id, title, discount_text, ends_at) values ('${V2}', 'Hile', '%90', now() + interval '7 days') returning id`);
await deny('mekan', 'başka mekanın kampanyasını durduramaz', `update campaigns set is_active = false where venue_id = '${V2}' returning id`);
const used = await allow('mekan', 'öğrencinin kodunu kullanabilir', `select * from redeem_code('${red.rows?.[0]?.code ?? 'XXXXXX'}')`, ONE);
check('mekan', 'kod kullanınca öğrencinin kimliği dönmez', used.ok && used.rows[0] && !('user_id' in used.rows[0]), JSON.stringify(used.rows?.[0] ?? {}));
await deny('mekan', 'aynı kodu ikinci kez kullanamaz', `select * from redeem_code('${red.rows?.[0]?.code ?? 'XXXXXX'}')`);
await allow('mekan', 'kendi mekanının kod kullanımlarını görür', `select * from venue_redemptions`, ONE);
await deny('mekan', 'kod kullanımlarında öğrenci kimliği yok', `select user_id from venue_redemptions`);
await deny('mekan', 'kod tablosunu doğrudan okuyamaz (öğrenci kimliği)', `select * from redemptions`);
await deny('mekan', 'öğrenci profillerini okuyamaz', `select * from profiles where id <> '${U.mekan}'`);
await deny('mekan', 'mekan bilgisini kendisi değiştiremez (admin onayı)', `update venues set name = 'x' where id = '${V1}' returning id`);

// =====================================================================
// ADMİN
// =====================================================================
await as('admin');
await allow('admin', 'mekan başvurularını görür', `select * from venue_applications`, SOME);
await allow('admin', 'başvuru durumunu güncelleyebilir', `update venue_applications set status = 'gorusuldu' returning id`, SOME);
await allow('admin', 'kapalı mekanları da görür', `select id from venues where is_active = false`, ONE);
await allow('admin', 'kampüs ekleyebilir', `insert into campuses (university_id, name, lat, lng) values (3, 'Kuzey Kampüs', 41.086, 29.050) returning id`, ONE);
await allow('admin', 'yorumları denetim için görebilir', `select id from reviews`, (r) => r.rows.length >= 3);

// --- Sonuç -----------------------------------------------------------
await db.exec('reset role');
const failed = results.filter((r) => !r.pass);
let lastRole = '';
for (const r of results) {
  if (r.role !== lastRole) {
    console.log(`\n${r.role.toUpperCase()}`);
    lastRole = r.role;
  }
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${!r.pass && r.detail ? `\n      → ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} kural geçti.`);
if (failed.length) {
  console.log(`${failed.length} kural BOZUK.`);
  process.exit(1);
}
