-- Supabase Schema untuk aplikasi Web Sholat
-- Jalankan isi file ini di Supabase SQL Editor proyek Anda.

-- Extension untuk fungsi pgcrypto (UUID)
create extension if not exists pgcrypto;

-- Tabel utama progres sholat
create table if not exists public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,               -- diisi saat pengguna login
  device_id text null,             -- fallback anonim per perangkat
  username text null,              -- identitas sederhana agar data persist lintas perangkat
  date date not null,              -- tanggal (YYYY-MM-DD)
  subuh boolean not null default false,
  dzuhur boolean not null default false,
  ashar boolean not null default false,
  maghrib boolean not null default false,
  isya boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Jika tabel sudah terlanjur dibuat tanpa kolom username,
-- tambahkan kolomnya agar index dan query di bawah tidak gagal.
alter table public.prayers add column if not exists username text null;

-- Unik per user per hari (khusus baris yang punya user_id)
create unique index if not exists prayers_user_date_unique
  on public.prayers (user_id, date)
  where user_id is not null;

-- Unik per device per hari (khusus baris yang punya device_id)
create unique index if not exists prayers_device_date_unique
  on public.prayers (device_id, date)
  where device_id is not null;

-- Unik per username per hari (khusus baris yang punya username)
create unique index if not exists prayers_username_date_unique
  on public.prayers (username, date)
  where username is not null;

-- Trigger untuk mengisi updated_at saat update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists prayers_updated_at on public.prayers;
create trigger prayers_updated_at
  before update on public.prayers
  for each row execute function public.set_updated_at();

-- Aktifkan Row Level Security
alter table public.prayers enable row level security;

-- Kebijakan akses publik sederhana (tanpa autentikasi) agar data bisa dipakai lintas perangkat
-- Perhatian: ini membuka tabel untuk dibaca/ditulis oleh semua klien dengan anon key.
drop policy if exists "public_read" on public.prayers;
create policy "public_read" on public.prayers
  for select
  to public
  using (true);

drop policy if exists "public_insert" on public.prayers;
create policy "public_insert" on public.prayers
  for insert
  to public
  with check (true);

drop policy if exists "public_update" on public.prayers;
create policy "public_update" on public.prayers
  for update
  to public
  using (true)
  with check (true);

-- OPSIONAL: kebijakan untuk baris anonim (tanpa login) berbasis device_id.
-- Perhatikan risiko keamanan: baris anonim dapat diakses oleh siapa pun.
-- Hanya aktifkan jika Anda benar-benar memerlukan cloud-sync tanpa login.
--
-- create policy if not exists "anon_read_device_rows" on public.prayers
--   for select to anon using (user_id is null);
-- create policy if not exists "anon_insert_device_rows" on public.prayers
--   for insert to anon with check (user_id is null);
-- create policy if not exists "anon_update_device_rows" on public.prayers
--   for update to anon using (user_id is null) with check (user_id is null);