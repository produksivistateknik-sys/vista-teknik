"""Membuat lapisan animasi lari maskot JRENG dari logo transparan.
Pakai: python potong_kaki_jreng.py <logo_transparan.png> <folder_keluaran> [lebar_px=640]
Keluaran: base.png (badan tanpa kaki), kaki-depan.png, kaki-belakang.png (ukuran sama, ditumpuk).
Koordinat poligon diukur pada logo 1254x1254 yang di-crop ke kotak isi (bbox)."""
import sys, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter
src_p, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 640
os.makedirs(out, exist_ok=True)
im = Image.open(src_p).convert('RGBA'); im = im.crop(im.getbbox()); W, H = im.size
P = lambda pts: [(x, y - 6) for x, y in pts]   # koordinat diukur sebelum crop (offset y = 6)
FRONT = P([(262,640),(300,550),(400,515),(500,535),(545,560),(600,555),(660,568),(692,620),(684,690),(640,702),(604,760),(562,812),(480,826),(380,802),(300,734)])
BACK  = P([(655,700),(705,655),(800,642),(868,676),(940,684),(1002,688),(1022,760),(1012,832),(940,852),(860,832),(790,792),(700,764),(652,734)])
def mask(p, grow=0):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(p, fill=255)
    if grow: m = m.filter(ImageFilter.MaxFilter(grow*2+1))
    return np.array(m) > 0
a = np.array(im)
mf, mb = mask(FRONT, 2), mask(BACK, 2) & ~mask(FRONT, 0)
pf = a.copy(); pf[~mf] = 0
pb = a.copy(); pb[~mb] = 0
hole = mask(FRONT, 1) | mask(BACK, 1)
inp = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2BGR), hole.astype(np.uint8)*255, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
base = a.copy(); base[hole] = 0
yy, xx = np.mgrid[0:H, 0:W]
reg = ((yy < 579) & (xx > 470) & (xx < 700)) | ((yy < 649) & (xx >= 640) & (xx < 870))
fill = hole & reg & (a[:, :, 3] > 8)
base[fill, :3] = inp[fill]; base[fill, 3] = 255
h2 = int(width * H / W)
for n, arr in (('base', base), ('kaki-depan', pf), ('kaki-belakang', pb)):
    Image.fromarray(arr, 'RGBA').resize((width, h2), Image.LANCZOS).save(os.path.join(out, n + '.png'), optimize=True)
print('selesai', width, h2, '| pivot kaki depan %.1f%% %.1f%% | belakang %.1f%% %.1f%%' % (660/W*100, 634/H*100, 780/W*100, 644/H*100))
