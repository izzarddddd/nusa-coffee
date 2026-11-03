# PRD: Website Ekspor Kopi (Green Bean B2B)

**Status:** Draft 1 · **Tanggal:** 2026-11-03 · **Referensi:** PRD Nusa Vanilla (disederhanakan dan diperbaiki)

> Tanda **[Asumsi]** berarti belum dikonfirmasi pemilik. Semua asumsi dikumpulkan di 7.4.

## 1. Ringkasan
Website toko ekspor kopi mentah (green bean) dengan satu penjual. Importir dan roaster di luar negeri melihat katalog dengan mutu yang jelas, meminta sampel, lalu meminta penawaran (RFQ). Pemilik mengelola produk dan RFQ dari portal admin. Waktunya sekarang: aturan anti-deforestasi Uni Eropa (EUDR) mulai berlaku akhir 2026, sehingga pembeli Eropa mencari pemasok yang bisa membuktikan asal kebun.

## 2. Latar belakang
- Ekspor kopi Indonesia naik tajam: sekitar 508,8 ribu ton pada 2025, naik sekitar 62,6% dari 2024 ([Databoks/BPS](https://databoks.katadata.co.id/en/agroindustry/statistics/6a687272edc9d/indonesias-coffee-export-performance-surges-in-2025)). Amerika Serikat jadi tujuan terbesar pada semester I 2025 ([Databoks](https://databoks.katadata.co.id/en/trade/statistics/68b900896b359/united-states-indonesias-top-coffee-export-destination-first-half-of-2025)).
- Pembeli kopi spesialti biasanya meminta sampel dulu, dan importir spesialti sering mensyaratkan minimal satu karung (60–70 kg) ([Cafe Imports](https://cafeimports.com/europe/blog/?p=590)). Jadi alur "sampel, lalu pesanan" harus ada sejak awal.
- EUDR berlaku mulai 30 Desember 2026 untuk operator menengah dan besar, dan 30 Juni 2027 untuk usaha mikro dan kecil. Kopi wajib disertai koordinat lahan (poligon untuk lahan di atas 4 hektare) ([ringkasan EFI](https://efi.int/sites/default/files/2026-08/preparedness-check-of-lao-coffee-for-eudr.pdf), [StoneX](https://www.stonex.com/en/insights/eudr-enters-a-new-phase-as-coffee-industry-shifts-from-preparation-to-execution/)). Sebagian sumber ini milik vendor kepatuhan, jadi teks aturan resminya perlu dicek.

## 3. Tujuan
- **Tujuan:** pembeli luar negeri bisa menilai mutu dan asal kopi, lalu meminta sampel atau penawaran tanpa perantara.
- **Hasil kunci [Asumsi, angka belum disetujui pemilik]:**
  1. Minimal 5 RFQ valid per bulan dalam 3 bulan setelah rilis.
  2. Minimal 3 permintaan sampel yang berlanjut menjadi RFQ dalam 3 bulan.
  3. Pemilik membalas 90% RFQ dalam 48 jam.

## 4. Segmen pasar
Tiga yang sudah disebut di referensi vanilla (importir, pengecer spesialis, admin) diganti dengan dua segmen berdasarkan pekerjaan yang ingin diselesaikan. **[Asumsi]** keduanya perlu dikonfirmasi pemilik.

1. **Importir/trader kopi spesialti** (Eropa, AS, Jepang): mencari pasokan lot berkualitas yang bisa ditelusuri.
2. **Roaster menengah yang membeli langsung:** mencari kopi tunggal asal dengan jumlah per kontrak kecil.

Batasan: pembelian eceran (B2C) dan pemasok lain tidak dilayani pada versi pertama.

## 5. Proposisi nilai

**Segmen 1: Importir/trader spesialti**
- **Who:** importir yang memasok roaster di Eropa/AS.
- **Why:** harus membuktikan asal kopi (EUDR) dan mutu, atau tidak bisa menjual.
- **What before:** mencari lewat perantara, mutu dan asal sulit diverifikasi, dokumen datang terlambat.
- **How:** halaman per lot dengan skor cupping, kadar air, ukuran biji, asal kebun/koperasi, dan koordinat lahan; sampel dan RFQ lewat satu formulir.
- **What after:** bisa memutuskan dan menyiapkan dokumen kepatuhan lebih cepat.
- **Alternatives:** trader perantara, platform sourcing online ([FreshCup](https://freshcup.com/online-green-coffee-sourcing/)), pameran dagang. Pilih kami bila asal lot terbukti dan harga langsung dari produsen.

**Segmen 2: Roaster menengah**
- **Who:** roaster yang ingin kopi asal tunggal dari satu pemasok tepercaya.
- **Why:** kesulitan menemukan pemasok Indonesia yang konsisten dan mau melayani jumlah kecil.
- **What before:** membeli lewat importir dengan jumlah minimum besar dan sedikit informasi asal.
- **How:** katalog dengan jumlah minimum jelas, sampel murah atau gratis, status RFQ yang bisa dicek.
- **What after:** pesanan pertama dengan risiko mutu lebih kecil.
- **Alternatives:** importir lokal dan marketplace B2B umum.

**Pernyataan nilai:** "Kopi Indonesia dengan mutu terukur dan asal kebun yang bisa dibuktikan, langsung dari produsen, dari sampel sampai kontrak."

## 6. Solusi

### 6.1 Alur utama
Pembeli membuka katalog → membuka halaman lot → meminta sampel atau mengirim RFQ → menerima nomor RFQ → mengecek status dengan nomor + email. Admin menerima notifikasi, menghubungi pembeli, dan mengubah status.

### 6.2 Fitur wajib (versi 1)
- **Katalog dan halaman lot:** nama, asal, varietas, proses (washed/natural/honey), grade, skor cupping, kadar air, ukuran biji, harga USD/kg (indikatif), stok, jumlah minimum.
- **Ketertelusuran lot (baru dibanding vanilla):** tiap lot punya ID, kebun/koperasi, tanggal panen, dan data lahan untuk kebutuhan EUDR. Data lahan **tidak** ditampilkan publik; hanya status "siap EUDR: ya/belum".
- **Permintaan sampel:** formulir pendek, dengan jumlah sampel dan alamat tujuan. Dihitung sebagai jenis permintaan sendiri.
- **RFQ:** perusahaan, kontak, negara, jumlah (kg), Incoterm, pelabuhan tujuan, catatan. Harga disimpan saat permintaan dibuat; nomor RFQ unik.
- **Cek status RFQ:** nomor + email, dengan pembatas percobaan.
- **Portal admin:** kelola produk dan lot, ubah status permintaan, lihat ringkasan.
- **Perlindungan spam (baru):** CAPTCHA (mis. Turnstile) dan pembatasan laju lewat Edge Function. Di versi vanilla, hanya honeypot yang dipakai, dan itu celah.
- **Notifikasi email ke admin** saat permintaan masuk. Di vanilla ini belum ada, padahal permintaan yang terlewat berarti pembeli hilang.
- **Dua bahasa: Inggris dan Indonesia.** Inggris adalah bahasa bawaan karena pembeli ada di luar negeri. Pengunjung bisa berpindah bahasa lewat tombol di semua halaman publik, dan pilihannya diingat. Yang diterjemahkan: seluruh teks halaman, nama dan deskripsi produk, formulir beserta pesan galatnya, email otomatis, serta judul dan deskripsi untuk mesin pencari. Setiap bahasa punya alamat sendiri agar bisa dicari di Google. Data teknis (angka mutu, harga, nomor RFQ) tidak berubah antar bahasa.

### 6.3 Teknologi
Memakai ulang susunan vanilla: web statis di GitHub Pages dan Supabase (Postgres, Auth, RLS) dengan aturan RFQ di fungsi database. Tambahan: Edge Function untuk email dan pembatasan laju. Untuk dua bahasa, teks antarmuka disimpan dalam satu berkas terjemahan per bahasa, dan kolom produk punya versi Inggris dan Indonesia. Vanilla memakai alamat berbasis `#`, yang tidak ramah mesin pencari, jadi alamat per bahasa (mis. `/en/` dan `/id/`) perlu diputuskan saat desain.

### 6.4 Asumsi dan pertanyaan terbuka
**Asumsi (belum dibuktikan):**
- **[Asumsi]** Pemilik adalah eksportir (atau bermitra dengan eksportir) berizin dan punya akses ke lot dengan data kebun.
- **[Asumsi]** Segmen 1 dan 2 benar, dan pasar utama mencakup Eropa, AS, dan Jepang.
- **[Asumsi]** Pembayaran lewat transfer bank (T/T) dan dikonfirmasi manual pada versi 1.
- **[Asumsi]** Jumlah hasil kunci di bagian 3 masuk akal untuk volume pemilik.
- **[Asumsi]** Skor cupping tersedia atau akan diuji oleh laboratorium.
- **[Asumsi]** Pemilik atau timnya bisa menulis atau memeriksa teks produk dalam kedua bahasa. Terjemahan mesin saja berisiko untuk istilah mutu dan hukum.

**Pertanyaan terbuka (hanya pemilik yang tahu):**
1. Dari mana asal kedua kopi itu, apa varietas dan prosesnya, dan berapa lot di awal?
2. Siapa yang menangani pengiriman dan dokumen ekspor: sendiri atau forwarder?
3. Apakah sampel gratis, berbayar, atau dikreditkan ke pesanan pertama?
4. Apakah data koordinat lahan sudah ada, dan siapa yang mengumpulkannya?
5. Portal admin memakai bahasa apa: Indonesia saja, atau Inggris dan Indonesia?
6. Bahasa lain (mis. Jerman atau Jepang) perlu dipertimbangkan setelah versi 1, mengingat pasar tujuan?

*Sudah diputuskan:* situs publik berbahasa Inggris (bawaan) dan Indonesia. Versi 1 hanya menjual **Arabika dan Robusta**; jenis kopi lain menyusul.

## 7. Rilis

**Versi 1 (perkiraan 8–10 minggu):** katalog dan halaman lot, sampel dan RFQ, cek status, portal admin, email admin, dan pembatas spam.

**Versi berikutnya:** generator dokumen ekspor (proforma, packing list), unggah COA per lot, harga bertingkat, pembayaran internasional, bahasa ketiga dan seterusnya, data lahan untuk pembeli EUDR.

**Sengaja tidak dikerjakan di versi 1:**
- Marketplace multi-penjual dan penjualan eceran (B2C).
- Pembayaran kartu kredit otomatis.
- Pelacakan kontainer.
- Aplikasi mobile.
- Animasi berat. Referensi vanilla punya aturan gerak yang panjang, dan itu **tidak** dibawa ke PRD ini. Detail visual diputuskan di tahap desain.
