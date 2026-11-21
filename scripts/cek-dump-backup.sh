#!/usr/bin/env bash
# Penjaga isi dump backup harian (dipanggil .github/workflows/backup-database.yml SEBELUM unggah ke R2).
#
# Gagal (exit 1) bila:
#   - berkas tidak ada / kosong / lebih kecil dari MIN_BYTES;
#   - tidak ada satu pun "CREATE TABLE public." (dump tidak masuk akal);
#   - dump memuat schema yang dikecualikan (CREATE SCHEMA / CREATE TABLE / COPY / INSERT INTO).
# Keluaran sengaja hanya angka + pesan generik: baris yang cocok dan nama schema terlarang TIDAK dicetak,
# karena log Actions repo ini publik. Skrip tidak membuat berkas sementara dan tidak mengakses jaringan.
#
# Pemakaian: bash scripts/cek-dump-backup.sh <berkas.sql | berkas.sql.gz>
# Uji lokal: ambang ukuran bisa diturunkan lewat env CEK_DUMP_MIN_BYTES (workflow tidak mengisinya).
set -euo pipefail

# Ambang ukuran minimum (byte). Dump nyata ~66 MB per Nov 2026.
MIN_BYTES="${CEK_DUMP_MIN_BYTES:-1000000}"

# Schema yang tidak boleh ada di dump (dipakai hanya di dalam pola, tidak pernah dicetak).
SCHEMA_TERLARANG='(hr|auth)'

gagal() { echo "cek-dump-backup: GAGAL - $1" >&2; exit 1; }

[ "$#" -eq 1 ] || gagal "butuh tepat 1 argumen (path berkas dump)"
BERKAS="$1"
[ -f "$BERKAS" ] || gagal "berkas dump tidak ditemukan"
[ -s "$BERKAS" ] || gagal "berkas dump kosong"

UKURAN=$(wc -c < "$BERKAS" | tr -d '[:space:]')
echo "cek-dump-backup: ukuran berkas ${UKURAN} byte (ambang minimum ${MIN_BYTES})"
[ "$UKURAN" -ge "$MIN_BYTES" ] || gagal "ukuran di bawah ambang minimum"

baca() {
  case "$BERKAS" in
    *.gz) gzip -cd -- "$BERKAS" ;;
    *)    cat -- "$BERKAS" ;;
  esac
}

# Hitung baris yang cocok. grep exit 1 = nol kecocokan (bukan error); exit >1 = error sungguhan.
hitung() {
  local n
  n=$(baca | LC_ALL=C grep -a -c -i -E "$@") || [ "$?" -eq 1 ] || gagal "tidak bisa membaca berkas dump"
  echo "${n:-0}"
}

S='[[:space:]]'
ID="\"?${SCHEMA_TERLARANG}\"?"
TERLARANG=$(hitung \
  -e "^${S}*CREATE${S}+SCHEMA${S}+(IF${S}+NOT${S}+EXISTS${S}+)?${ID}(${S}|;|\$)" \
  -e "^${S}*CREATE${S}+((UNLOGGED|TEMP|TEMPORARY)${S}+)?TABLE${S}+(IF${S}+NOT${S}+EXISTS${S}+)?${ID}\." \
  -e "^${S}*COPY${S}+${ID}\." \
  -e "^${S}*INSERT${S}+INTO${S}+${ID}\.")

TABEL_PUBLIC=$(hitung -e "^${S}*CREATE${S}+((UNLOGGED)${S}+)?TABLE${S}+(IF${S}+NOT${S}+EXISTS${S}+)?\"?public\"?\.")

echo "cek-dump-backup: tabel public: ${TABEL_PUBLIC}"
[ "$TERLARANG" -eq 0 ] || gagal "schema terlarang terdeteksi: ${TERLARANG} baris"
[ "$TABEL_PUBLIC" -gt 0 ] || gagal "tidak ada CREATE TABLE public. - dump tidak masuk akal"

echo "cek-dump-backup: LULUS (schema terlarang: 0 baris)"
