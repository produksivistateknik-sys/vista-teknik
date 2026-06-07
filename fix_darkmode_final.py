from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah CSS yang sangat aggressive di akhir dark mode section
old = '[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}'

new = '''[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}

/* ── DARK MODE FORCE OVERRIDE ── */
[data-theme="dark"] .erp-topbar{background:#16181f!important;border-color:#2d3148!important}
[data-theme="dark"] .erp-search{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}

/* Force semua div putih ke dark */
[data-theme="dark"] .erp-main div:not([class*="badge"]):not([class*="status"]):not([class*="tag"]) {
  --local-bg: var(--card-bg);
}

/* Target spesifik elemen berdasarkan posisi */
[data-theme="dark"] .fi > div,
[data-theme="dark"] .fi > div > div:not([style*="background:#"]):not([style*="background:linear"]):not([style*="background:rgb"]) {
  background-color: var(--card-bg, #1a1d27) !important;
  color: var(--text-primary, #e2e8f0) !important;
  border-color: var(--border-color, #2d3148) !important;
}

/* Modal */
[data-theme="dark"] div[style*="position:fixed"][style*="inset:0"] > div {
  background:#1a1d27!important;
  border-color:#2d3148!important;
}

/* Override inline background:#fff */
[data-theme="dark"] div[style*="background:#fff"],
[data-theme="dark"] div[style*="background: #fff"],
[data-theme="dark"] div[style*="background:white"] {
  background:#1a1d27!important;
}
[data-theme="dark"] div[style*="background:#f8fafc"] {
  background:#1e2130!important;
}
[data-theme="dark"] div[style*="background:#f1f5f9"] {
  background:#222536!important;
}
[data-theme="dark"] div[style*="background:#f9fafb"],
[data-theme="dark"] div[style*="background:#fafafa"] {
  background:#1e2130!important;
}

/* Force text colors */
[data-theme="dark"] div[style*="color:#1e293b"],
[data-theme="dark"] span[style*="color:#1e293b"],
[data-theme="dark"] td[style*="color:#1e293b"],
[data-theme="dark"] p[style*="color:#1e293b"] {
  color:#e2e8f0!important;
}
[data-theme="dark"] div[style*="color:#475569"],
[data-theme="dark"] span[style*="color:#475569"],
[data-theme="dark"] td[style*="color:#475569"] {
  color:#94a3b8!important;
}
[data-theme="dark"] div[style*="color:#64748b"],
[data-theme="dark"] span[style*="color:#64748b"],
[data-theme="dark"] td[style*="color:#64748b"] {
  color:#64748b!important;
}

/* Table */
[data-theme="dark"] table {
  background:#1a1d27!important;
}
[data-theme="dark"] td {
  background:#1a1d27!important;
  border-color:#2d3148!important;
  color:#e2e8f0!important;
}
[data-theme="dark"] tr:nth-child(even) td {
  background:#1e2130!important;
}
[data-theme="dark"] th {
  background:#0f1117!important;
  color:#94a3b8!important;
  border-color:#2d3148!important;
}

/* Input & Select */
[data-theme="dark"] input[style],
[data-theme="dark"] select[style],
[data-theme="dark"] textarea[style] {
  background:#222536!important;
  border-color:#2d3148!important;
  color:#e2e8f0!important;
}'''

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Dark mode CSS final added!")
else:
    print("❌ Anchor not found")
    # cari alternatif
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'erp-card' in l and 'dark' in l:
            print(f"  {i+1}: {l.strip()[:80]}")
