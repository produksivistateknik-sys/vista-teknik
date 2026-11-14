"""Pembuat aset logo JRENG (13 Nov 2026). Alat di komputer pengembang saja - BUKAN dependensi aplikasi.
Pakai: python scripts/brand/buat_aset_jreng.py   (butuh Pillow: pip install --user Pillow)
Sumber satu-satunya: public/brand/jreng-logo-full.png (1254x1254 RGBA transparan). Semua turunan dibuat ulang dari situ.
Alpha >= 240 dibulatkan ke 255 (sumber beralpha 252-254 = 99% opak; keputusan user), tepi halus (< 240) tetap.
Kop surat / watermark / logoAsset.ts TIDAK disentuh.
Revisi 14 Nov (keputusan user): favicon & ikon 'any' 192/512 TRANSPARAN; maskable & apple-touch tetap putih; badge =
siluet badan maskot saja (tanpa petir/garis kecepatan); lapisan animasi lari dari potong_kaki_jreng.py dikompres ke
public/brand/anim/. Butuh juga numpy + opencv-python-headless (alat lokal) utk potong_kaki_jreng.py.
"""
import os
import subprocess
import sys
import tempfile
import numpy as np
from PIL import Image, ImageDraw

AKAR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUB = os.path.join(AKAR, 'public')
SUMBER = os.path.join(PUB, 'brand', 'jreng-logo-full.png')
V = 'v2'
PUTIH = (255, 255, 255, 255)


def rapatkan_alpha(im):
    r, g, b, a = im.split()
    a = a.point(lambda x: 255 if x >= 240 else x)
    return Image.merge('RGBA', (r, g, b, a))


def potong(im):
    return im.crop(im.getchannel('A').getbbox())


def muat(im, w, h):
    """Perkecil im agar muat di kotak w x h (rasio tetap), LANCZOS."""
    s = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def kanvas(logo, sisi, porsi, latar):
    """Logo di tengah kanvas persegi; porsi = bagian sisi yang boleh dipakai logo."""
    k = Image.new('RGBA', (sisi, sisi), latar)
    l = muat(logo, sisi * porsi, sisi * porsi)
    k.alpha_composite(l, ((sisi - l.width) // 2, (sisi - l.height) // 2))
    return k


def simpan(im, nama, rgb=False, palet=True):
    """PNG dioptimalkan. palet=True: dikuantisasi ke 256 warna (Floyd-Steinberg) - logo kartun warna datar, beda
    tidak terlihat, berat turun ~60-70%. Alpha ikut dipertahankan (FASTOCTREE mendukung RGBA)."""
    p = os.path.join(PUB, nama)
    im = im.convert('RGB') if rgb else im
    if palet:
        im = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        if im.palette and im.palette.mode == 'RGBA':  # kuantisasi menggeser alpha 255 ke 250-254 -> bulatkan lagi di palet
            pal = im.getpalette('RGBA')
            for i in range(3, len(pal), 4):
                if pal[i] >= 240:
                    pal[i] = 255
            im.putpalette(pal, 'RGBA')
    im.save(p, optimize=True)
    return p


def main():
    src = Image.open(SUMBER)
    assert src.size == (1254, 1254) and src.mode == 'RGBA', (src.size, src.mode)
    logo = potong(rapatkan_alpha(src))
    hasil = []
    BENING = (255, 255, 255, 0)
    # Ikon aplikasi: any (192/512) & favicon TRANSPARAN; maskable & apple-touch latar putih, dgn padding (any: 88% sisi; maskable: 60% sisi - ujung bolt & pita tulisan
    # tetap di dalam lingkaran aman radius 40% W3C; 66% sedikit melewatinya, temuan ui-reviewer)
    hasil.append(simpan(kanvas(logo, 512, 0.94, BENING), f'brand/icon-512-{V}.png'))
    hasil.append(simpan(kanvas(logo, 192, 0.94, BENING), f'brand/icon-192-{V}.png'))
    hasil.append(simpan(kanvas(logo, 512, 0.60, PUTIH), f'brand/icon-maskable-512-{V}.png', rgb=True))
    hasil.append(simpan(kanvas(logo, 180, 0.88, PUTIH), f'brand/apple-touch-icon-180-{V}.png', rgb=True))
    hasil.append(simpan(kanvas(logo, 32, 1.0, BENING), f'brand/favicon-32-{V}.png'))
    hasil.append(simpan(kanvas(logo, 16, 1.0, BENING), f'brand/favicon-16-{V}.png'))
    ico = os.path.join(PUB, 'favicon.ico')
    kanvas(logo, 48, 1.0, BENING).save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
    hasil.append(ico)
    # Logo pojok atas (transparan): 2x tinggi tampil 62 px
    hasil.append(simpan(muat(logo, 1000, 124), f'brand/logo-header-{V}.png'))
    # Logo halaman Masuk & Login (transparan): 2x lebar tampil 260 px
    hasil.append(simpan(muat(logo, 520, 520), f'brand/logo-splash-{V}.png'))
    # Badge notifikasi: siluet putih (alpha murni) BADAN maskot saja - petir & garis kecepatan dibuang lewat poligon
    # (koordinat sumber 1254 px), bintik sisa garis dibuang (komponen < 4000 px). Tanpa detail dalam: di 24 dp detail pecah.
    import cv2
    poli = [(130, 300), (330, 120), (640, 0), (880, 110), (890, 330), (1000, 350), (1110, 410), (1145, 560), (1050, 610),
            (960, 625), (1015, 700), (1015, 790), (900, 840), (780, 805), (700, 760), (600, 800), (560, 830), (380, 820),
            (270, 730), (250, 560), (120, 440)]
    m = Image.new('L', src.size, 0)
    ImageDraw.Draw(m).polygon(poli, fill=255)
    biner = ((np.array(m) > 0) & (np.array(src.getchannel('A')) >= 128)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(biner, 8)
    simpan_ = np.zeros_like(biner)
    for i in range(1, n):
        if st[i, 4] > 4000:
            simpan_[lab == i] = 255
    a = Image.fromarray(simpan_)
    siluet = Image.new('RGBA', src.size, (255, 255, 255, 0))
    siluet.putalpha(a)
    siluet = siluet.crop(a.getbbox())
    hasil.append(simpan(kanvas(siluet, 96, 0.92, BENING), f'brand/badge-96-{V}.png'))
    # Lapisan animasi lari: dibuat potong_kaki_jreng.py (640 px) ke folder sementara, lalu alpha dirapatkan & dikompres.
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'potong_kaki_jreng.py'), SUMBER, tmp, '640'], check=True)
        # Perbaikan sudut badan, garis kecepatan, kontur hantu (opsi b user 14 Nov) - lihat perbaiki_lapisan_jreng.py
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'perbaiki_lapisan_jreng.py'), tmp], check=True)
        os.makedirs(os.path.join(PUB, 'brand', 'anim'), exist_ok=True)
        for nm in ('base', 'kaki-belakang', 'kaki-depan'):
            hasil.append(simpan(rapatkan_alpha(Image.open(os.path.join(tmp, nm + '.png')).convert('RGBA')), f'brand/anim/{nm}.png'))
    for p in hasil:
        im = Image.open(p)
        print(f'{os.path.relpath(p, AKAR):45} {im.size[0]}x{im.size[1]:<5} {im.mode:5} alpha={"ya" if (im.mode in ("RGBA","LA") or "transparency" in im.info) else "tidak":5} {os.path.getsize(p)/1024:7.1f} KB')


if __name__ == '__main__':
    main()
