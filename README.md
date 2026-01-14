# Web Sholat – Jaga Sholatmu, Jaga Hidupmu

Aplikasi web minimalis untuk menjaga konsistensi sholat 5 waktu, menandai progres harian, melihat ringkasan bulanan, dan memotivasi ibadah dengan tampilan yang tenang dan fokus.

## Gambaran Umum
- Menyediakan checklist sholat harian dengan status "Selesai" per waktu.
- Menampilkan progres harian dalam bentuk bar dan teks yang sederhana.
- Menawarkan motivasi harian yang berganti secara deterministik setiap hari.
- Mendukung kalender bulanan untuk memantau konsistensi ibadah sepanjang bulan.
- Menampilkan statistik bulan: jumlah hari dengan 5/5, rata-rata harian, dan total sholat selesai.
- Mode Fokus Ibadah untuk meminimalkan distraksi saat menggunakan aplikasi.

## Fitur Utama
- Checklist 5 waktu: Subuh, Dzuhur, Ashar, Maghrib, Isya.
- Progres harian dan pembaruan otomatis saat Anda menandai.
- Kalender grid yang responsif dengan ringkasan per hari.
- Statistik bulan yang ringkas dan mudah dipahami.
- Motivasi harian untuk menjaga semangat ibadah.
- Jadwal sholat (opsional) via Aladhan API.

## Sinkronisasi Data
- Lokal per perangkat: status hari ini disimpan di `localStorage` untuk kecepatan dan ketahanan offline.
- Lintas perangkat (opsional): menggunakan Supabase dan username sederhana. Aplikasi membaca data "Hari ini" dari server terlebih dahulu; data lokal hanya dikirim jika server kosong. Ini mencegah penimpaan data antar perangkat.
- Identitas yang digunakan: `username` (utama) atau fallback `device_id`. Struktur tabel Supabase: `public.prayers` dengan kolom `username`, `device_id`, `date`, dan status tiap waktu.

## Cara Pakai
- Buka aplikasi, ceklis sholat sesuai selesai.
- Klik "Masuk dengan Username" untuk sinkronisasi antar perangkat; gunakan username yang sama di setiap perangkat.
- Saat Anda membuka ulang, aplikasi memuat dari server terlebih dahulu (jika tersedia), sehingga status mengikuti data terakhir Anda.

## Privasi & Keamanan
- Tidak memerlukan data pribadi selain username sederhana untuk sinkronisasi.
- Penyimpanan lokal berada di browser Anda dan dapat dihapus kapan saja.
- Mode sinkronisasi menggunakan kunci publik; kebijakan akses database dapat disesuaikan pada Supabase oleh pemilik deploy.

## Desain & Kinerja
- Tampilan minimalis, ringan, dan responsif di perangkat seluler maupun desktop.
- Waktu muat cepat; sinkronisasi berjalan di latar belakang agar tidak mengganggu interaksi.

## Teknologi
- HTML, CSS, dan JavaScript (vanilla).
- Supabase (opsional) untuk penyimpanan cloud dan sinkronisasi.
- Aladhan API (opsional) untuk jadwal sholat.

## Struktur Proyek
- `index.html` — halaman utama aplikasi.
- `styles.css` — gaya antarmuka yang bersih dan tenang.
- `script.js` — logika checklist, progres, kalender, sinkronisasi, dan motivasi.
- `config.js` — konfigurasi Supabase (opsional, hanya untuk pemilik deploy).
- `supabase/schema.sql` — skema tabel `public.prayers` dan kebijakan akses.

## Roadmap Ringkas
- Riwayat mingguan/bulanan yang lebih mendalam.
- Grafik progres dan tren konsistensi.
- Penyesuaian statistik (misal: hanya menghitung hari yang memiliki data).

## Kontribusi & Kredit
- Terbuka untuk saran fitur, perbaikan bug, dan peningkatan aksesibilitas.
- Berterima kasih kepada komunitas penyedia API dan layanan yang mendukung aplikasi ini.