// Cek logika status proses SINKRON antara vista-teknik & vista-pekerja (6 Nov 2026). File ini identik di kedua repo.
// Jalankan: npm run cek:cermin  (sebelum push kalau mengubah fungsi di bawah). Asal: perbaikan getBestProgress 14 Sep hanya masuk
// vista-teknik, operator terkunci "Not Yet" padahal admin "To Do". Isi fungsi dibandingkan tanpa komentar, spasi, dan tipe TS.
// Repo sebelah tidak ada (mis. di Vercel) -> dilewati.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'
const akar=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const namaRepo=path.basename(akar)
const sebelah=path.join(akar,'..',namaRepo==='vista-pekerja'?'vista-teknik':'vista-pekerja')
const fileHelper=r=>path.join(r,'src/lib',path.basename(r)==='vista-pekerja'?'panelHelpers.tsx':'panelHelpers.ts')
const FUNGSI=['getLatestProgress','getProgressFromHistory','getBestProgress','getBestProgressMap','prosesGerbangStatus','computeProsesStatus','alasanNotYet']
if(!fs.existsSync(sebelah)){console.log('cek:cermin - repo sebelah tidak ditemukan ('+sebelah+'), dilewati.');process.exit(0)}
const bersih=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:"'])\/\/.*$/gm,'$1').replace(/\s+/g,'')
  .replace(/:(any|string|number|ProsesStatus|string\[\]|Record<string,number>(\|undefined\|null)?)(?=[,)={])/g,'')
function isiFungsi(teks,nama){
  const i=teks.search(new RegExp('export function '+nama+'\\s*\\('))
  if(i<0)return null
  let j=teks.indexOf('(',i),buka=0
  for(;;j++){if(teks[j]==='(')buka++;else if(teks[j]===')'&&--buka===0)break}
  j=teks.indexOf('{',j);buka=0
  const awal=i
  for(;;j++){if(teks[j]==='{')buka++;else if(teks[j]==='}'&&--buka===0)return bersih(teks.slice(awal,j+1))}
}
const a=fs.readFileSync(fileHelper(akar),'utf8'),b=fs.readFileSync(fileHelper(sebelah),'utf8')
let beda=0
for(const n of FUNGSI){const x=isiFungsi(a,n),y=isiFungsi(b,n);const ok=x&&y&&x===y;if(!ok)beda++;console.log((ok?'OK   ':'BEDA ')+n)}
const gerbang=t=>(t.match(/PROSES_STATUS_GATE_PCT\s*=\s*(\d+)/)||[])[1]
if(gerbang(a)!==gerbang(b)){beda++;console.log('BEDA PROSES_STATUS_GATE_PCT')}else console.log('OK   PROSES_STATUS_GATE_PCT='+gerbang(a))
if(beda){console.log('\ncek:cermin - '+beda+' fungsi TIDAK sinkron. Samakan dulu sebelum push.');process.exit(1)}
console.log('\ncek:cermin - logika status sinkron dgn '+path.basename(sebelah)+'.')
