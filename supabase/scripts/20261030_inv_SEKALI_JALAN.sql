-- SEKALI JALAN: impor 124 barang + migrasi data maintenance lama + cek otomatis (T1, 29 Okt 2026).
-- Cukup: buka file ini di SQL Editor -> Run. Tidak ada yang perlu diedit (admin = LUTVAN).
-- AMAN: semua dalam SATU transaksi. Bila satu saja cek di bawah tidak sesuai, SEMUANYA dibatalkan otomatis
-- (database kembali seperti sebelum dijalankan) dan galat "DIBATALKAN: ..." menyebut cek yang gagal.
-- Dry-run impor sudah Anda jalankan & sesuai; migrasi data lama sudah diuji di Postgres lokal dengan data yang sama.
-- Hasil sukses: satu tabel ringkasan di bawah, semua kolom cek = true.
begin;
do $do$
declare v_ak constant jsonb := '{"admin":"LUTVAN"}'; h1 jsonb; h2 jsonb; v_gagal text[] := '{}';
begin
  if exists (select 1 from public.inv_barang) then
    raise exception 'DIBATALKAN: inv_barang sudah berisi % baris - impor sudah pernah dijalankan', (select count(*) from public.inv_barang);
  end if;
  h1 := public.inv_impor($IMPOR$[{"kunci":"GA:2","nama":"Mesin CNC Laser","lokasi_kode":"MKN","pengguna":"AfiF,Sandi","kondisi":"baik","detail_kondisi":"Mesin masih berfungsi normal","merk_spesifikasi":"BAISON, EC3, E-SERIES","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:3","nama":"Mesin Potong Manual","lokasi_kode":"MKN","pengguna":"AfiF,Sandi","kondisi":"tidak_maksimal","detail_kondisi":"tidak bisa dipakai potong stainlees/pisau kurang tajam","merk_spesifikasi":"HECTMAC, OC12Y-8X3200","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:4","nama":"Mesin Bending","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"tidak_maksimal","detail_kondisi":"Saat dipakai bending, hasilnya sering tidak siku","merk_spesifikasi":"HECTMAC, WC67Y-160/3200","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:5","nama":"Cutting Wheel Vanbelt","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","detail_kondisi":"Mesin sudah berfungsi normal, baru saja ganti vanbelt yang putus.","merk_spesifikasi":"WIPRO, TORNADO-100","tanggal_perolehan":"2025-02-07","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:6","nama":"Cutting Wheel Rotor","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"tidak_maksimal","detail_kondisi":"Roda Cutting tidak lurus saat memotong","merk_spesifikasi":"MAKITA, 2414NB","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:7","nama":"Mesin Las 1","lokasi_kode":"MKN","pengguna":"Edi Marwoto","kondisi":"baik","detail_kondisi":"berfungsi normal tapi di bagian pelindung kabel ada yang sudah leleh/terkelupas","merk_spesifikasi":"LAKONI, FALCON 205E","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:8","nama":"Mesin Las 2","lokasi_kode":"MKN","pengguna":"Siswoyo","kondisi":"baik","detail_kondisi":"berfungsi normal tapi di bagian pelindung kabel ada yang sudah leleh/terkelupas","merk_spesifikasi":"LAKONI, FALCON 205E","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:9","nama":"Mesin Gerinda 1","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","detail_kondisi":"Berfungsi normal, kabel gantian (bukan bawaan)","merk_spesifikasi":"Makita","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:10","nama":"Mesin Gerinda 2","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","detail_kondisi":"bisa digunakan, sudah beberapa kali maintenance","merk_spesifikasi":"Makita","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:11","nama":"Mesin Gerinda 3","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"tidak_maksimal","detail_kondisi":"Tidak dipakai, karena sering trouble","merk_spesifikasi":"Makita","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:12","nama":"Mesin Bor Duduk","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"tidak_maksimal","merk_spesifikasi":"WIPRO, ZJ4116","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:13","nama":"Mesin Bor Besar","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:14","nama":"Mesin Bor Sedang 1","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"tidak_maksimal","detail_kondisi":"switch drill dan non drill tidak berfungsi","merk_spesifikasi":"Makita","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:15","nama":"Mesin Bor Sedang 2","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:16","nama":"Mesin Bor Kecil","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:17","nama":"Mesin Poles Stainless","lokasi_kode":"MKN","pengguna":"Edi Marwoto, Siswoyo","kondisi":"baik","detail_kondisi":"Masih sangat normal, karena baru beli dan jarang dipakai","merk_spesifikasi":"Makita","pelapor":"LUTVAN","diperbarui_pada":"2026-10-10T00:00:00+07:00"},
{"kunci":"GA:18","nama":"Crane","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"baik","detail_kondisi":"Berfungsi, cuma ketika dipakai sering ng","merk_spesifikasi":"Hinatsu","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:19","nama":"Jet Spray Gun 1","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"baik","merk_spesifikasi":"K'archer","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:20","nama":"Jet Spray Gun 2","lokasi_kode":"WH","pengguna":"Kholel,Dwi","kondisi":"baik","detail_kondisi":"Disimpan di Gudang","merk_spesifikasi":"Krisbow","pelapor":"LUTVAN","diperbarui_pada":"2026-10-09T00:00:00+07:00"},
{"kunci":"GA:21","nama":"Gerinda","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"perlu_maintenance","detail_kondisi":"sedang dalam proses maintenance (subekan)","merk_spesifikasi":"Makita","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:22","nama":"Spray Gun Powder 1","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"baik","detail_kondisi":"Masih Digunakan, daya semprot juga sedikit menurun, sudah dimaintenance","merk_spesifikasi":"Most","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:23","nama":"Spray Gun Powder 2","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"perlu_maintenance","detail_kondisi":"Daya Semprot tidak maksimal","merk_spesifikasi":"Most","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:24","nama":"Spray Gun Powder 3","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"perlu_maintenance","detail_kondisi":"Tidak Dipakai, Macet","merk_spesifikasi":"Most","pelapor":"LUTVAN","diperbarui_pada":"2026-10-09T00:00:00+07:00"},
{"kunci":"GA:25","nama":"Oven","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"baik","detail_kondisi":"Baru diservice, performa oven kembali stabil","merk_spesifikasi":"-","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:26","nama":"Spray Cat Minyak","lokasi_kode":"PT","pengguna":"Kholel,Dwi","kondisi":"baik","detail_kondisi":"Masih berfungsi normal, baru beli","merk_spesifikasi":"Meiji","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:27","nama":"Power Pack Biru","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Barton Tools","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:28","nama":"Power Pack Hitam","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"-","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:29","nama":"Power Pack Oren","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"perlu_maintenance","detail_kondisi":"Oli Bocor, masih bisa digunakan","merk_spesifikasi":"-","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:30","nama":"Hydraulic Puncher 1","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Fort","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:31","nama":"Hydraulic Puncher 2","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Fort","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:32","nama":"Bending Kecil","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"tidak_maksimal","detail_kondisi":"Hasil bending tidak presisi","merk_spesifikasi":"Fort","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:33","nama":"Bending Besar 1","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"OPT","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:34","nama":"Bending Besar 2","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:35","nama":"Alat Potong Besar","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"tidak_maksimal","detail_kondisi":"Pisau kurang tajam,hasil potong kasar","merk_spesifikasi":"Fort","pelapor":"LUTVAN","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:36","nama":"Alat Potong Kecil","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"TCI","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:37","nama":"Gerinda Mesin","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:38","nama":"Gerinda Mesin","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:39","nama":"Bor Duduk","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Wipro","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:40","nama":"Bor Mesin 1","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:41","nama":"Bor Mesin 2","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:42","nama":"Bor Mesin 3","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:43","nama":"Vacum Besar","lokasi_kode":"WS","kondisi":"baik","merk_spesifikasi":"Krisbow","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:44","nama":"Vacum Kecil","lokasi_kode":"WS","kondisi":"tidak_maksimal","merk_spesifikasi":"Krisbow","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:45","nama":"Hot Gun 1","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:46","nama":"Hot Gun 2","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:47","nama":"Hot Gun 3","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:48","nama":"Hot Gun 4","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:49","nama":"Hot Gun 5","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Black Decker","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:50","nama":"Hot Gun 6","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Black Decker","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:51","nama":"Mesin Impact","lokasi_kode":"ASB","pengguna":"Ari Okta, Roni","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:52","nama":"Mesin Print Marker","lokasi_kode":"WR","pengguna":"Rafik","kondisi":"baik","merk_spesifikasi":"Canon MK3000","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:53","nama":"Bor Mesin","lokasi_kode":"WR","pengguna":"Rafik","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:54","nama":"Tang Pres Hydrolic","lokasi_kode":"WR","pengguna":"Vaim","kondisi":"baik","merk_spesifikasi":"Krisbow","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:55","nama":"Mesin Bor Impact","lokasi_kode":"QC","pengguna":"Joko","kondisi":"baik","merk_spesifikasi":"Makita","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:56","nama":"Torsi","lokasi_kode":"QC","pengguna":"Joko","kondisi":"baik","merk_spesifikasi":"Tekiro","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:57","nama":"Mesin Bor Impact","lokasi_kode":"QC","pengguna":"Joko","kondisi":"baik","merk_spesifikasi":"Makita","tanggal_perolehan":"2024-09-09","tanggal_perolehan_teks":"09-09-2024","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:58","nama":"Laptop 1","lokasi_kode":"WH","pengguna":"Fawzi","kondisi":"belum_dinilai","merk_spesifikasi":"HP Intel i3-7100U, SILVER","nomor_seri":"00327-70000-00001-AA660","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:59","nama":"Laptop 2","lokasi_kode":"KTR","pengguna":"Nadia","kondisi":"baik","merk_spesifikasi":"HP Intel i5-1035GI, HITAM","nomor_seri":"00327-36344-28945-AA0EM","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:60","nama":"Laptop 3","lokasi_kode":"HR","pengguna":"Putri","kondisi":"perlu_maintenance","detail_kondisi":"Baterai sering drop","merk_spesifikasi":"MSI Intel core i5-11400H , HITAM","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:61","nama":"Laptop 4","lokasi_kode":"KTR","pengguna":"Bu Jeany","kondisi":"belum_dinilai","merk_spesifikasi":"Asus, HIJAU","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:62","nama":"Laptop 5","lokasi_kode":"NP","pengguna":"Pak Indra","kondisi":"perlu_maintenance","detail_kondisi":"Baterai sering drop","merk_spesifikasi":"Asus VivoBook14 , BIRU","nomor_seri":"00327-36279-35171-AAOEM","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:63","nama":"Laptop 6","lokasi_kode":"KTR","kondisi":"rusak","merk_spesifikasi":"Macbook Pro, Intel core i7, SILVER","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:64","nama":"Laptop 7","lokasi_kode":"HR","pengguna":"Zidny","kondisi":"baik","merk_spesifikasi":"Asus E402W, AMD E2, HITAM","nomor_seri":"00327-35113-73514-AAOEM","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:65","nama":"Laptop 8","lokasi_kode":"KTR","pengguna":"Pak Oki","kondisi":"baik","merk_spesifikasi":"Asus intel core i5-5200, SILVER","nomor_seri":"00331-10000-00001-AA211","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:66","nama":"Laptop 9","lokasi_kode":"KTR","pengguna":"Pak Kis","kondisi":"baik","tanggal_perolehan":"2025-11-14","tanggal_perolehan_teks":"14-11-2025","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:67","nama":"Mesin Gravir kecil","lokasi_kode":"NP","pengguna":"Wildan","kondisi":"baik","merk_spesifikasi":"INNOVATECH 30X40","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:68","nama":"Mesin Gravir besar","lokasi_kode":"NP","pengguna":"Wildan","kondisi":"perlu_maintenance","merk_spesifikasi":"INNOVATECH 60X90","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:69","nama":"Komputer","lokasi_kode":"NP","pengguna":"Wildan","kondisi":"baik","merk_spesifikasi":"LG,19M38H-B","nomor_seri":"404INGQEA703","tanggal_perolehan":"2025-05-24","tanggal_perolehan_teks":"24-Mei-2025","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:70","nama":"CPU","lokasi_kode":"NP","pengguna":"Wildan","kondisi":"baik","merk_spesifikasi":"SIMBADDA","tanggal_perolehan":"2025-05-24","tanggal_perolehan_teks":"24-Mei-2025","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:71","nama":"Printer","lokasi_kode":"NP","pengguna":"Lutvan,Wildan","kondisi":"baik","merk_spesifikasi":"EPSON, L120","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:72","nama":"Tablet","lokasi_kode":"NP","pengguna":"Lutvan,Dimas","kondisi":"baik","merk_spesifikasi":"Redmi Pad SE","tanggal_perolehan":"2026-04-01","tanggal_perolehan_teks":"01-04-2026","diperbarui_pada":"2026-10-08T00:00:00+07:00"},
{"kunci":"GA:73","nama":"Forklift","lokasi_kode":"PKR","pengguna":"Triyanto","kondisi":"baik","merk_spesifikasi":"Caterpillar","diperbarui_pada":"2026-10-09T00:00:00+07:00"},
{"kunci":"GA:74","nama":"Hand Forklift","lokasi_kode":"WS","pengguna":"Triyanto","kondisi":"perlu_maintenance","diperbarui_pada":"2026-10-09T00:00:00+07:00"},
{"kunci":"GA:75","nama":"Monitor 01","lokasi_kode":"KTR","pengguna":"Firda","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GT 740 (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:76","nama":"PC 01","lokasi_kode":"KTR","pengguna":"Firda","kondisi":"baik","detail_kondisi":"Perlu anti Virus","merk_spesifikasi":"i5 - 2500, 8 GB","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:77","nama":"Monitor 02","lokasi_kode":"KTR","pengguna":"Fitri","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GT 730 (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:78","nama":"PC 02","lokasi_kode":"KTR","pengguna":"Fitri","kondisi":"baik","detail_kondisi":"Perlu anti Virus","merk_spesifikasi":"i5 - 4590 (8GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:79","nama":"Monitor 03","lokasi_kode":"KTR","pengguna":"Indri","kondisi":"baik","merk_spesifikasi":"Lenovo HD Graphics 530 (128 MB)","tanggal_perolehan":"2026-02-21","tanggal_perolehan_teks":"21-02-2026","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:80","nama":"PC 03","lokasi_kode":"KTR","pengguna":"Indri","kondisi":"baik","merk_spesifikasi":"i5 - 6500 (8GB)","tanggal_perolehan":"2026-02-21","tanggal_perolehan_teks":"21-02-2026","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:81","nama":"Monitor 04","lokasi_kode":"KTR","pengguna":"Wulan","kondisi":"baik","merk_spesifikasi":"Lenovo HD Graphics (32 MB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:82","nama":"PC 04","lokasi_kode":"KTR","pengguna":"Wulan","kondisi":"baik","merk_spesifikasi":"i5 - 2500 (8GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:83","nama":"Monitor 05","lokasi_kode":"KTR","pengguna":"Jihan","kondisi":"baik","merk_spesifikasi":"Samsung NVIDIA GeForce GTX 750 Ti (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:84","nama":"PC 05","lokasi_kode":"KTR","pengguna":"Jihan","kondisi":"baik","merk_spesifikasi":"i5 - 8500 (16 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:85","nama":"Monitor 06","lokasi_kode":"KTR","pengguna":"Edo","kondisi":"baik","merk_spesifikasi":"Lenovo L22e - 40 NVIDIA GeForce GT 730 (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:86","nama":"PC 06","lokasi_kode":"KTR","pengguna":"Edo","kondisi":"baik","merk_spesifikasi":"i7 - 2600 (16 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:87","nama":"Monitor 07","lokasi_kode":"KTR","pengguna":"Aemilia","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GT 740 (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:88","nama":"PC 07","lokasi_kode":"KTR","pengguna":"Aemilia","kondisi":"baik","merk_spesifikasi":"i5 - 2500 (16GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:89","nama":"Monitor 08","lokasi_kode":"KTR","pengguna":"Frendi","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GTX 750 Ti (4Gb)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:90","nama":"PC 08","lokasi_kode":"KTR","pengguna":"Frendi","kondisi":"baik","merk_spesifikasi":"i5 - 6600 (16 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:91","nama":"Monitor 09","lokasi_kode":"KTR","pengguna":"Yoppy","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GT 730 (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:92","nama":"PC 09","lokasi_kode":"KTR","pengguna":"Yoppy","kondisi":"baik","merk_spesifikasi":"i5 - 4590 (16 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:93","nama":"Monitor 10","lokasi_kode":"KTR","pengguna":"Ihsan","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GT 1030 , HD Graphics 4600","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:94","nama":"PC 10","lokasi_kode":"KTR","pengguna":"Ihsan","kondisi":"baik","merk_spesifikasi":"i5 - 4590 (16 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:95","nama":"Monitor 11","lokasi_kode":"KTR","pengguna":"Nadia","kondisi":"baik","merk_spesifikasi":"Lenovo HD Graphics 530 (128 MB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:96","nama":"PC 11","lokasi_kode":"KTR","pengguna":"Nadia","kondisi":"baik","merk_spesifikasi":"i5 - 6600 (8GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:97","nama":"Monitor 12","lokasi_kode":"KTR","pengguna":"Dewi","kondisi":"baik","merk_spesifikasi":"Lenovo DESKTOP-BC84KSM","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:98","nama":"PC 12","lokasi_kode":"KTR","pengguna":"Dewi","kondisi":"baik","merk_spesifikasi":"i7 - 26000 (8 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:99","nama":"Monitor 13","lokasi_kode":"KTR","pengguna":"Erni","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:100","nama":"PC 13","lokasi_kode":"KTR","pengguna":"Erni","kondisi":"baik","merk_spesifikasi":"i5 - 2500 (8GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:101","nama":"Monitor 14","lokasi_kode":"KTR","pengguna":"Sahda","kondisi":"baik","merk_spesifikasi":"Lenovo NVIDIA GeForce GT 730 (4GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:102","nama":"PC 14","lokasi_kode":"KTR","pengguna":"Sahda","kondisi":"baik","merk_spesifikasi":"i5 - 4590 (8 GB)","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:103","nama":"Printer Estimasi","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"Epson L3211","tanggal_perolehan":"2026-06-18","tanggal_perolehan_teks":"18-06-2026"},
{"kunci":"GA:104","nama":"Printer Keuangan","lokasi_kode":"KTR","pengguna":"Firda, Fitri","kondisi":"baik","merk_spesifikasi":"EPSON L3210","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:105","nama":"Printer Purchasing","lokasi_kode":"KTR","pengguna":"Indri, Wulan","kondisi":"baik","merk_spesifikasi":"EPSON L3210","tanggal_perolehan":"2025-06-24","tanggal_perolehan_teks":"24-06-2025","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:106","nama":"Mesin Fotocopy","lokasi_kode":"KTR","kondisi":"perlu_maintenance","detail_kondisi":"Terakhir service juli 2026","merk_spesifikasi":"CANON 112 2535","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-14T00:00:00+07:00"},
{"kunci":"GA:107","nama":"AC (01)","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"Midea","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:108","nama":"AC (02)","lokasi_kode":"KTR","kondisi":"perlu_maintenance","detail_kondisi":"Kadang berbunyi dan kurang dingin","merk_spesifikasi":"Midea","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:109","nama":"AC Keuangan","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"LG","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:110","nama":"AC R. Meeting","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"Midea","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:111","nama":"AC R. Server","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"LG","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:112","nama":"AC R. Direktur","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"LG","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:113","nama":"Proyektor R. meeting","lokasi_kode":"KTR","kondisi":"baik","merk_spesifikasi":"Acer","tanggal_perolehan":"2022-07-31","tanggal_perolehan_teks":"31-07-2022","pelapor":"Dewi Wulandari","diperbarui_pada":"2026-10-15T00:00:00+07:00"},
{"kunci":"GA:114","nama":"AC R. HRD","lokasi_kode":"HR","kondisi":"belum_dinilai"},
{"kunci":"GA:115","nama":"AC Gudang","lokasi_kode":"WH","kondisi":"tidak_maksimal","detail_kondisi":"Ac hanya keluar angin tdk dingin","merk_spesifikasi":"Midea","diperbarui_pada":"2026-10-21T00:00:00+07:00"},
{"kunci":"GA:116","nama":"Monitor 15","lokasi_kode":"WH","pengguna":"Dita","kondisi":"baik","merk_spesifikasi":"LG HD Graphics 530","diperbarui_pada":"2026-10-21T00:00:00+07:00"},
{"kunci":"GA:117","nama":"PC 15","lokasi_kode":"WH","pengguna":"Dita","kondisi":"perlu_maintenance","detail_kondisi":"Perlu update windows","merk_spesifikasi":"i5 - 6600 (8GB)","diperbarui_pada":"2026-10-21T00:00:00+07:00"},
{"kunci":"GA:118","nama":"Monitor 16","lokasi_kode":"WH","pengguna":"Vanda","kondisi":"baik","merk_spesifikasi":"LG HD Graphics 4400","diperbarui_pada":"2026-10-21T00:00:00+07:00"},
{"kunci":"GA:119","nama":"PC 16","lokasi_kode":"WH","pengguna":"Vanda","kondisi":"perlu_maintenance","detail_kondisi":"Perlu update windows","merk_spesifikasi":"i3 - 4160","diperbarui_pada":"2026-10-21T00:00:00+07:00"},
{"kunci":"GA:120","nama":"AC R. P. Kis","lokasi_kode":"BELUM","kondisi":"baik"},
{"kunci":"GA:121","nama":"Apar","lokasi_kode":"BELUM","kondisi":"baik","tanggal_perolehan":"2022-01-07","tanggal_perolehan_teks":"07-01-2022"},
{"kunci":"GA:122","nama":"AC R. Nameplate","lokasi_kode":"NP","kondisi":"baik","detail_kondisi":"Masih Baruu","merk_spesifikasi":"Gree 1,5PK","tanggal_perolehan":"2026-09-18","tanggal_perolehan_teks":"18-09-2026","pelapor":"LUTVAN"},
{"kunci":"BARU:BAK-1","nama":"BAK DEGREASING","lokasi_kode":"PT","kondisi":"belum_dinilai","baru":true},
{"kunci":"BARU:BAK-3","nama":"BAK PHOSPHATING","lokasi_kode":"PT","kondisi":"belum_dinilai","baru":true},
{"kunci":"BARU:BAK-2","nama":"BAK AIR","lokasi_kode":"PT","kondisi":"belum_dinilai","baru":true}]$IMPOR$::jsonb, false, 'GA - DATABASE INVENTARIS VISTA.xlsx', v_ak);
  h2 := public.inv_migrasi_data_lama(false, v_ak);

  if (h1->>'dibuat')::int <> 124 then v_gagal := v_gagal || ('impor dibuat ' || (h1->>'dibuat')); end if;
  if (select string_agg(kode_lokasi || '=' || terakhir, ',' order by kode_lokasi) from public.inv_nomor_penghitung)
     <> 'ASB=23,HR=3,KTR=44,MKN=16,NP=8,PKR=1,PT=11,QC=3,WH=7,WS=3' then v_gagal := v_gagal || 'nomor terakhir per lokasi'::text; end if;
  if (select count(*) from public.inv_barang where nomor_inventaris is null) <> 5 then v_gagal := v_gagal || 'jumlah tanpa nomor'::text; end if;
  if (select nomor_inventaris from public.inv_barang where impor_kunci = 'BARU:BAK-1') <> 'VIT-PT-09'
     or (select nomor_inventaris from public.inv_barang where impor_kunci = 'BARU:BAK-3') <> 'VIT-PT-10'
     or (select nomor_inventaris from public.inv_barang where impor_kunci = 'BARU:BAK-2') <> 'VIT-PT-11' then v_gagal := v_gagal || 'nomor bak'::text; end if;
  if (select count(*) from public.inv_barang where mesin_id_lama is not null) <> 9 then v_gagal := v_gagal || 'barang terhubung kode lama'::text; end if;
  if (h2->'lama_tidak_terpetakan'->>'jadwal')::int <> 0 or (h2->'lama_tidak_terpetakan'->>'selesai')::int <> 0
     or (h2->'lama_tidak_terpetakan'->>'laporan')::int <> 0 then v_gagal := v_gagal || ('data lama tidak terpetakan ' || (h2->>'lama_tidak_terpetakan')); end if;
  if (select count(*) from public.inv_media where peran in ('selesai','lama'))
     <> (select coalesce(sum(jsonb_array_length(coalesce(l.foto, '[]'))), 0) from public.maintenance_rutin_log l join public.maintenance_rutin r on r.id = l.rutin_id join public.inv_padanan_lama p on p.mesin_id_lama = r.mesin_id)
      + (select coalesce(sum(jsonb_array_length(coalesce(m.foto, '[]'))), 0) from public.maintenance_log m join public.inv_padanan_lama p on p.mesin_id_lama = m.mesin_id)
     then v_gagal := v_gagal || 'jumlah media'::text; end if;
  if exists (select 1 from public.inv_barang b where exists (select 1 from public.inv_laporan l where l.barang_id = b.id and l.status <> 'closed') and b.kondisi <> 'rusak')
     then v_gagal := v_gagal || 'laporan aktif belum Rusak'::text; end if;
  if exists (select 1 from public.inv_jadwal j join public.maintenance_rutin r on r.id = j.rutin_id_lama
             where j.jatuh_tempo is distinct from r.jatuh_tempo or j.aktif <> coalesce(r.is_active, true)) then v_gagal := v_gagal || 'jadwal beda dgn lama'::text; end if;
  if array_length(v_gagal, 1) > 0 then raise exception 'DIBATALKAN (tidak ada yang tersimpan): %', array_to_string(v_gagal, '; '); end if;
end $do$;

select (select count(*) from public.inv_barang)                                    as barang,
       (select count(*) from public.inv_barang where nomor_inventaris is not null)  as bernomor,
       (select count(*) from public.inv_jadwal)                                     as jadwal,
       (select count(*) from public.inv_jadwal_selesai)                             as riwayat_selesai,
       (select count(*) from public.inv_laporan)                                    as laporan,
       (select count(*) from public.inv_laporan where status <> 'closed')           as laporan_aktif,
       (select count(*) from public.inv_media)                                      as media,
       (select string_agg(kondisi || ' ' || n, ', ' order by kondisi) from (select kondisi, count(*) n from public.inv_barang group by 1) x) as kondisi,
       (select string_agg(kode_lama || '=' || nomor_inventaris, ', ' order by kode_lama) from public.inv_barang where kode_lama is not null) as kode_lama,
       true as semua_cek_lulus;
commit;
