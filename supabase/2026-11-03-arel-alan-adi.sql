-- Arel öğrenci e-posta alan adı düzeltmesi (2026-11-03)
-- schema.sql daha önce çalıştırıldıysa Supabase → SQL Editor'de bunu bir kez çalıştırın.
-- (schema.sql'deki örnek veri "on conflict do nothing" olduğu için mevcut satırı güncellemez.)
update public.universities
set domains = array['istanbularel.edu.tr']
where id = 1;

-- Kontrol: Arel satırı istanbularel.edu.tr göstermeli
select id, short_name, domains from public.universities where id = 1;
