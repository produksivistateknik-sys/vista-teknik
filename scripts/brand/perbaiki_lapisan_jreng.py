"""Perbaiki lapisan animasi lari JRENG hasil potong_kaki_jreng.py (14 Nov 2026, keputusan user opsi b).
Pakai: python perbaiki_lapisan_jreng.py <folder_lapisan_640>   (menimpa base/kaki-depan/kaki-belakang di folder itu)
Dipanggil buat_aset_jreng.py. Alat lokal (numpy + opencv-python-headless + Pillow), BUKAN dependensi aplikasi.
potong_kaki_jreng.py (milik user) tidak diubah; skrip ini bekerja pada keluarannya (kanvas 640x643).

AYUNAN YANG DIUJI (WAJIB dipakai Tahap 4 - angka CSS, +theta = searah jarum jam):
  kaki depan    rotate -10deg <-> +10deg, pivot 53.1% 50.8%; translateY -8px (tampilan 190-210px) saat di -10deg
                (kaki TERANGKAT ketika berayun ke bawah-kiri = arah huruf J), 0px saat di +10deg. Periode 0,72 s.
  kaki belakang rotate +12deg <-> -12deg (berlawanan fase), pivot 62.8% 51.6%.
  Diuji 8 pose (bukti) + 64 sampel per siklus pada tampilan 190 & 210 px: sepatu depan tidak pernah menutup huruf J
  (0 piksel). Dengan -6px sepatu masih menyentuh sudut kanan-atas garis tepi J 3-4 px -> lift dinaikkan ke -8px.

Perbaikan:
 (i)   sudut kiri-bawah badan panel + alas (plinth) biru digambar ulang (sisi kiri & bawah diteruskan lurus dari bagian
       yang terlihat, garis tepi navy 3 px);
 (ii)  lubang lain diisi ulang (inpaint Navier-Stokes RGB + alpha) supaya garis kecepatan biru/oranye bersambung di
       belakang kaki dan latar tetap transparan di tempat yang memang latar;
 (iii) sisa kontur gelap kaki di luar poligon potong ("hantu") dipindah dari base ke lapisan kakinya;
 sela di antara kedua kaki di bawah alas diisi navy gelap (bayangan/celana) agar tidak tembus.
"""
import os
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

NAVY_TEPI = (12, 30, 78)
BAYANGAN = (14, 34, 86)


def poli_mask(shape, pts):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.array(m) > 0


def main(d):
    L = lambda n: np.array(Image.open(os.path.join(d, n + '.png')).convert('RGBA'))
    base, dep, bel = L('base'), L('kaki-depan'), L('kaki-belakang')
    H, W = base.shape[:2]
    assert (W, H) == (640, 643), (W, H)
    yy, xx = np.mgrid[0:H, 0:W]
    kaki = (dep[:, :, 3] > 0) | (bel[:, :, 3] > 0)

    # Zona yang TIDAK boleh disentuh: tulisan JRENG (y >= 418), lengan kiri (atas-kiri lubang).
    tulisan = yy >= 418
    lengan = (yy < 276) & (xx < 198)

    # (iii) kontur hantu: piksel gelap base dalam 8 px di luar kaki, di luar zona lindung -> ikut ke lapisan kaki terdekat
    dekat = cv2.dilate(kaki.astype(np.uint8), np.ones((17, 17), np.uint8)) > 0
    lum = base[:, :, :3] @ np.array([0.299, 0.587, 0.114])
    badan_atas = poli_mask(base.shape, [(150, 0), (640, 0), (640, 300), (330, 300), (204, 276), (196, 200), (150, 200)])
    hantu = dekat & ~kaki & (base[:, :, 3] > 0) & (lum < 75) & ~tulisan & ~lengan & ~badan_atas
    # hanya komponen kecil/tipis yang menempel ke kaki (bukan bagian besar lain)
    n, lab, st, _ = cv2.connectedComponentsWithStats(hantu.astype(np.uint8), 8)
    hantu2 = np.zeros_like(hantu)
    for i in range(1, n):
        if st[i, 4] <= 900:
            hantu2 |= lab == i
    jd = cv2.distanceTransform((~(dep[:, :, 3] > 0)).astype(np.uint8), cv2.DIST_L2, 3)
    jb = cv2.distanceTransform((~(bel[:, :, 3] > 0)).astype(np.uint8), cv2.DIST_L2, 3)
    ke_dep = hantu2 & (jd <= jb)
    ke_bel = hantu2 & (jd > jb)
    dep[ke_dep & (dep[:, :, 3] == 0)] = base[ke_dep & (dep[:, :, 3] == 0)]
    bel[ke_bel & (bel[:, :, 3] == 0)] = base[ke_bel & (bel[:, :, 3] == 0)]
    base[hantu2] = 0

    # Lubang = tempat kaki (diam) yang di base tidak opak.
    kaki = (dep[:, :, 3] > 0) | (bel[:, :, 3] > 0)
    lubang = kaki & (base[:, :, 3] < 250)

    # (ii) isi ulang umum: inpaint RGB & alpha dari tepi lubang (garis kecepatan bersambung, latar tetap transparan)
    m8 = (cv2.dilate(lubang.astype(np.uint8), np.ones((3, 3), np.uint8)) * 255)
    bgr = cv2.cvtColor(np.ascontiguousarray(base[:, :, :3]), cv2.COLOR_RGB2BGR)
    rgb = cv2.cvtColor(cv2.inpaint(bgr, m8, 9, cv2.INPAINT_NS), cv2.COLOR_BGR2RGB)
    alp = cv2.inpaint(np.ascontiguousarray(base[:, :, 3]), m8, 9, cv2.INPAINT_NS)
    isi = m8 > 0
    base[isi, :3] = rgb[isi]
    a = alp[isi].astype(np.int32)
    base[isi, 3] = np.where(a >= 150, 255, np.where(a <= 90, 0, a)).astype(np.uint8)
    # Antara sepatu depan & huruf J = latar: isi ulang di sini dikosongkan (cegah bercak putih di sudut J)
    dekat_j = isi & (yy >= 395) & (xx <= 232) & ~tulisan
    base[dekat_j] = 0

    # (i) badan panel: muka putih diteruskan sampai sudut (204,277); alas biru di bawahnya; garis tepi navy.
    img = Image.fromarray(base)
    dr = ImageDraw.Draw(img)
    muka = [(196, 226), (204, 277), (332, 303), (332, 262), (240, 262), (240, 226)]
    lum2 = base[:, :, :3] @ np.array([0.299, 0.587, 0.114])
    # busur kontur kaki yang tertinggal DI muka panel (y >= 255, di bawah mulut) ikut dicat ulang
    mm = poli_mask(base.shape, muka) & (lubang | ((lum2 < 150) & (yy >= 255)))
    # kiri tepi panel = latar: pudaran abu-abu hasil inpaint dikosongkan (kecuali lengan)
    tepi_x = np.where(yy <= 277, 196 + 8 * (yy - 226) / 51, 204 + 8 * (yy - 277) / 31)
    kiri = lubang & (yy >= 226) & (yy <= 345) & (xx < tepi_x - 2) & ~lengan
    base[kiri] = 0
    # di bawah alas, kiri sela = latar di belakang kaki depan: pudaran inpaint dikosongkan
    bawah_alas = lubang & (xx < 300) & (yy > 308 + 28 * (xx - 212) / 126 + 2) & (yy < 405)
    base[bawah_alas] = 0
    img = Image.fromarray(base)
    ref = base[(xx >= 250) & (xx <= 320) & (yy >= 268) & (yy <= 292) & (base[:, :, 3] == 255)]
    warna_muka = tuple(int(v) for v in np.median(ref[:, :3], axis=0)) if len(ref) else (236, 240, 250)
    plinth_ref = base[(xx >= 345) & (xx <= 400) & (yy >= 310) & (yy <= 325) & (base[:, :, 3] == 255)]
    warna_alas = tuple(int(v) for v in np.median(plinth_ref[:, :3], axis=0)) if len(plinth_ref) else (40, 100, 210)
    arr = np.array(img)
    arr[mm, :3] = warna_muka
    arr[mm, 3] = 255
    img = Image.fromarray(arr)
    dr = ImageDraw.Draw(img)
    alas = [(204, 277), (332, 303), (338, 336), (212, 308)]
    dr.polygon(alas, fill=warna_alas + (255,))
    dr.line([(196, 226), (204, 277), (212, 308), (338, 336)], fill=NAVY_TEPI + (255,), width=4)
    dr.line([(204, 277), (332, 303)], fill=NAVY_TEPI + (255,), width=3)
    # sela kedua kaki di bawah alas: bayangan/celana navy gelap (tidak tembus)
    sela = [(300, 318), (392, 334), (398, 368), (340, 380), (300, 352)]
    sm = poli_mask(base.shape, sela) & lubang
    arr = np.array(img)
    arr[sm, :3] = BAYANGAN
    arr[sm, 3] = 255
    base = arr

    for n_, a_ in (('base', base), ('kaki-depan', dep), ('kaki-belakang', bel)):
        Image.fromarray(a_, 'RGBA').save(os.path.join(d, n_ + '.png'))
    print(f'perbaiki: hantu dipindah {int(hantu2.sum())} px (depan {int(ke_dep.sum())}, belakang {int(ke_bel.sum())}) | '
          f'lubang diisi {int(isi.sum())} px | muka {int(mm.sum())} px | sela {int(sm.sum())} px | warna muka {warna_muka} alas {warna_alas}')


if __name__ == '__main__':
    main(sys.argv[1])
