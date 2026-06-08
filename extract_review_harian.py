import re

file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Keywords yang dicari
keywords = [
    "dateTasks", "reviewHarian", "review_harian", "ReviewHarian",
    "Rencana Harian", "rencanaHarian", "selectedDate", "dateModal",
    "pekerjaan", "Detail Status", "Belum Mulai"
]

found_ranges = []

for i, line in enumerate(lines):
    for kw in keywords:
        if kw in line:
            start = max(0, i - 2)
            end = min(len(lines), i + 3)
            found_ranges.append((start, end, kw, i + 1))
            break

# Merge overlapping ranges
merged = []
for start, end, kw, lineno in sorted(found_ranges):
    if merged and start <= merged[-1][1]:
        merged[-1] = (merged[-1][0], max(merged[-1][1], end), merged[-1][2], merged[-1][3])
    else:
        merged.append([start, end, kw, lineno])

output_lines = []
output_lines.append("=" * 70)
output_lines.append("EXTRACT: Review Harian / dateTasks dari App.tsx")
output_lines.append("=" * 70)

# Ambil juga blok render besar di sekitar keyword utama
main_keywords = ["dateTasks", "dateModal", "selectedDate"]
big_blocks = []

for i, line in enumerate(lines):
    for kw in main_keywords:
        if kw in line:
            start = max(0, i - 5)
            end = min(len(lines), i + 50)
            big_blocks.append((start, end))
            break

# Merge big blocks
merged_big = []
for start, end in sorted(big_blocks):
    if merged_big and start <= merged_big[-1][1]:
        merged_big[-1] = (merged_big[-1][0], max(merged_big[-1][1], end))
    else:
        merged_big.append([start, end])

for start, end in merged_big:
    output_lines.append(f"\n--- Baris {start+1} s/d {end} ---")
    for j in range(start, end):
        output_lines.append(f"{j+1:5d}\t{lines[j].rstrip()}")

output = "\n".join(output_lines)

out_path = r"C:\Users\User\vista-teknik\extract_review_harian.txt"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(output)

print(f"[OK] Hasil extract disimpan ke: {out_path}")
print(f"[INFO] Total baris ditemukan: {len(output_lines)}")
