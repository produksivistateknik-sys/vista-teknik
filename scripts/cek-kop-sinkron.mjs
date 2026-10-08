// Cek kop surat SINKRON antara vista-teknik & vista-pekerja (7 Okt 2026). File ini identik di kedua repo.
// Jalankan: npm run cek:kop  (sebelum push kalau mengubah kop). Membandingkan isi file kop di repo ini dgn
// repo "sebelah" (folder saudara ../vista-teknik atau ../vista-pekerja). Repo sebelah tidak ada (mis. di
// Vercel) -> dilewati. Akhir baris CRLF/LF dianggap sama.
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url'
const akar=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const namaRepo=path.basename(akar)
const sebelah=path.join(akar,'..',namaRepo==='vista-pekerja'?'vista-teknik':'vista-pekerja')
const FILE=['src/lib/kopSuratKonfig.ts','src/lib/kopSuratAsetUrl.ts','src/assets/kop/vista-logo-clean.png','src/assets/kop/Carlito-Regular.ttf','src/assets/kop/Carlito-Bold.ttf','src/assets/kop/OFL-Carlito.txt','scripts/cek-kop-sinkron.mjs',
  // (8 Okt 2026) komponen bersama lain yang wajib identik di kedua repo:
  'src/components/ui/MediaPickerSheet.tsx']
if(!fs.existsSync(sebelah)){console.log('cek:kop - repo sebelah tidak ditemukan ('+sebelah+'), dilewati.');process.exit(0)}
const sidik=f=>{if(!fs.existsSync(f))return null;let b=fs.readFileSync(f);if(/\.(ts|mjs|txt)$/.test(f))b=Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));return crypto.createHash('sha256').update(b).digest('hex')}
let beda=0
for(const f of FILE){const a=sidik(path.join(akar,f)),b=sidik(path.join(sebelah,f));const ok=a&&b&&a===b;if(!ok)beda++;console.log((ok?'  sama   ':'  BEDA   ')+f+(a?'':' (tidak ada di '+namaRepo+')')+(b?'':' (tidak ada di repo sebelah)'))}
if(beda){console.log('\ncek:kop - '+beda+' file kop TIDAK sinkron. Samakan dulu (salin dari repo yang benar) sebelum push.');process.exit(1)}
console.log('\ncek:kop - semua file kop sinkron dgn '+path.basename(sebelah)+'.')
