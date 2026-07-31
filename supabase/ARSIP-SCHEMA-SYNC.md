# Sinkronisasi skema tabel Arsip Panel

Fitur Arsip Panel (`arsip_panel()` / `unarsip_panel()` RPC di database, dipicu dari
`ManajemenWO.tsx`) memindahkan baris antar tabel lewat dua helper generik:

- `arsip_pindah_tabel(p_table, p_col, p_panel_id, p_user)`
- `arsip_kembalikan_tabel(p_table, p_col, p_panel_id)`

Keduanya membangun daftar kolom `INSERT` **secara dinamis dari tabel SUMBER**
(`p_table`) lewat `information_schema.columns`, lalu insert ke `<p_table>_archived`
(atau sebaliknya). Ini artinya kolom apa pun yang ada di tabel sumber TAPI tidak
ada di tabel arsip pasangannya akan bikin error runtime:
`column "X" of relation "Y_archived" does not exist` - persis insiden 31 Jul 2026
(kolom `busbar_jejak` ketinggalan di `raw_schedule_archived`).

## WAJIB: setiap migrasi yang nambah kolom ke salah satu tabel di bawah HARUS
## sekalian nambah kolom yang SAMA PERSIS (nama, tipe, default, nullable) ke
## tabel arsip pasangannya, di migrasi/perubahan yang sama.

| Tabel sumber | Tabel arsip |
|---|---|
| `raw_schedule` | `raw_schedule_archived` |
| `renhar` | `renhar_archived` |
| `fcs_schedule` | `fcs_schedule_archived` |
| `fcs_timer_kerja` | `fcs_timer_kerja_archived` |
| `progress_checkpoint_log` | `progress_checkpoint_log_archived` |
| `kendala` | `kendala_archived` |
| `fcs_tracking_komponen` | `fcs_tracking_komponen_archived` |
| `fcs_tracking_komponen_foto` | `fcs_tracking_komponen_foto_archived` (insert manual di `arsip_panel()`, bukan lewat helper generik - cek juga) |
| `panels` | `panels_archived` (kolom di-generate dinamis juga, tapi punya kolom tambahan `progress_snapshot`/`wo_number_snapshot`/`proyek_snapshot` yang legitimate, jangan dihapus) |

Cara cepat cek semua pasangan sekaligus (butuh `supabase db query --linked`,
service-role/DB access - tidak bisa lewat anon key client-side):

```sql
SELECT table_name, column_name, data_type, udt_name, column_default, is_nullable, ordinal_position
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('raw_schedule','raw_schedule_archived', ...)
ORDER BY table_name, ordinal_position;
```

lalu diff kolom per pasangan (lihat kolom yang ada di sumber tapi hilang di arsip).

Reminder yang sama juga ditulis sebagai `COMMENT ON TABLE`/`COMMENT ON FUNCTION`
langsung di database (muncul di Supabase Studio saat lihat tabel/fungsi ini).
