# Web Sholat – Deploy dan Supabase

Aplikasi minimalis untuk menjaga progres sholat harian dengan kalender bulanan, statistik ringkas, dan login Google via Supabase.

## Fitur
- Checklist sholat 5 waktu dan progres harian.
- Kalender bulan berjalan dengan navigasi bulan dan auto-refresh saat ganti bulan.
- Statistik bulanan: Hari 5/5, Rata-rata harian, Total selesai.
- Login Google (Supabase Auth); penyimpanan berbasis `user_id`. Fallback `device_id` saat belum login.

## Konfigurasi Supabase
1. Buat proyek di Supabase Dashboard.
2. Buka menu **SQL Editor** dan jalankan file `supabase/schema.sql` dari repo ini.
   - Tabel `public.prayers` akan dibuat, termasuk indeks unik dan kebijakan RLS.
3. Aktifkan login Google: **Authentication → Providers → Google** (isi Client ID/Secret).
4. Set `Site URL` ke domain Vercel: **Authentication → URL Configuration** (tambahkan domain lokal jika diperlukan).
5. Dapatkan `PROJECT REF` dan `ANON KEY` dari **Project Settings → API**.

## Pengaturan Kredensial di Aplikasi
Edit `config.js` dan isi:

```js
window.SUPABASE_URL = 'https://<PROJECT_REF>.supabase.co';
window.SUPABASE_ANON_KEY = '<ANON_PUBLIC_KEY>';
```

Karena aplikasi ini statis, `ANON_KEY` (yang memang public) dimuat di klien.
Untuk setup yang lebih rapi, Anda dapat melakukan injeksi env saat build dan menghasilkan `config.js` otomatis.

## Deploy ke Vercel
1. Hubungkan repo GitHub ini ke Vercel.
2. Deploy sebagai project statis (memiliki `index.html`, `styles.css`, `script.js`).
3. Pastikan `config.js` berisi kredensial Supabase yang benar.

## Catatan RLS
- Default kebijakan mengizinkan akses hanya untuk pengguna login (`authenticated`) terhadap baris dengan `user_id = auth.uid()`.
- Opsi kebijakan untuk baris anonim (`anon`) via `device_id` disediakan sebagai komentar di `schema.sql`. Aktifkan hanya jika diperlukan.

## Pengujian
- Tanpa login: data tersimpan di `localStorage`. Jika kebijakan anon diaktifkan, data bisa sinkron dengan `device_id`.
- Dengan login: klik "Masuk via Google", data per hari di-upsert menggunakan `user_id`. Kalender dan statistik menarik data dari Supabase.

## Pengembangan Lanjutan
- Migrasi data lokal ke akun saat login pertama kali.
- Halaman riwayat dan grafik mingguan/bulanan.
- Penyesuaian perhitungan rata-rata (misal hanya hari yang memiliki data).