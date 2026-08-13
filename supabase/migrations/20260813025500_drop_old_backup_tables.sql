-- Cleanup: drop 49 one-off manual backup tables (public.*_backup_*) accumulated from
-- ad-hoc fix/cleanup sessions between 2026-07-17 and 2026-08-08. Every table dropped
-- here was fully dumped to db_backups/2026-08-13T02-49-41-548Z/*.sql (data-only INSERT
-- statements, verified row counts match pg_total_relation_size row estimates exactly)
-- before this migration was applied. Does NOT touch any "*_archived" table - those are
-- a separate, intentionally-retained feature (panel/raw_schedule/etc archival), not
-- cleanup leftovers.

DROP TABLE IF EXISTS "public"."admins_backup_20260805_prehash";
DROP TABLE IF EXISTS "public"."bom_master_backup_20260729";
DROP TABLE IF EXISTS "public"."bom_master_backup_20260729_v2";
DROP TABLE IF EXISTS "public"."fcs_schedule_backup_20260805_siblingfix";
DROP TABLE IF EXISTS "public"."fcs_schedule_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."fcs_timer_kerja_backup_20260801_operatorkosong";
DROP TABLE IF EXISTS "public"."fcs_timer_kerja_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."fcs_tracking_komponen_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."fcs_tracking_komponen_foto_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."kendala_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."maintenance_log_backup_20260731";
DROP TABLE IF EXISTS "public"."maintenance_rutin_log_backup_20260731";
DROP TABLE IF EXISTS "public"."operator_users_backup_20260805_prehash";
DROP TABLE IF EXISTS "public"."panels_backup_20260717";
DROP TABLE IF EXISTS "public"."panels_backup_20260717_v2";
DROP TABLE IF EXISTS "public"."panels_backup_20260729";
DROP TABLE IF EXISTS "public"."panels_backup_20260802_qcfotofix";
DROP TABLE IF EXISTS "public"."panels_backup_20260805_qtysilentfail";
DROP TABLE IF EXISTS "public"."panels_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."panels_backup_bomfix_20260729";
DROP TABLE IF EXISTS "public"."progress_checkpoint_log_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."raw_schedule_archived_backup_20260731";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260717";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260724";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260727";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260727_v2";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260801_operatorkosong";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260801_wiringcapfix";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260802_wiringhoptrail";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260803_gapfix";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260804_wiringoktober";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260805_10panelrestore";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260805_muisregen_undo";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260805_qtysilentfail";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260805_siblingfix";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_20260808_qtysync";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_arsipfeat_20260729";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_beforerestore_20260730";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_busbarjejak_20260730";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_jejakrevisi_20260729";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_manualgeser_20260730";
DROP TABLE IF EXISTS "public"."raw_schedule_backup_sweepchronic_20260730";
DROP TABLE IF EXISTS "public"."renhar_backup_20260717";
DROP TABLE IF EXISTS "public"."renhar_backup_20260803_gapfix";
DROP TABLE IF EXISTS "public"."renhar_backup_20260805_10panelrestore";
DROP TABLE IF EXISTS "public"."renhar_backup_20260805_siblingfix";
DROP TABLE IF EXISTS "public"."renhar_backup_20260806_komponen_sync";
DROP TABLE IF EXISTS "public"."renhar_backup_20260806_raw_sync";
DROP TABLE IF EXISTS "public"."renhar_backup_arsipfeat_20260729";
