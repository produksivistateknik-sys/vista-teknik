const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix semua logActivity di RawSchedule dengan format yang benar
const fixes = [
  [
    `if(logActivity) logActivity({action:"Tambah "+wp,aktivitas:"Tambah "+wp+" ("+komps.length+" komponen) ke Raw Schedule",halaman:"Raw Schedule",jenis:"update",table_name:"raw_schedule"});`,
    `if(logActivity) logActivity({admin_nama:user?.name||user?.nama||"Admin",action:"Tambah WP ke Raw Schedule",aktivitas:"Tambah "+wp+" ("+komps.length+" komponen) ke jadwal",jenis:"update",halaman:"Raw Schedule",table_name:"raw_schedule",user_name:user?.name||user?.nama||"Admin"});`
  ],
  [
    `if(logActivity) logActivity({action:"Hapus Raw Schedule",aktivitas:"Hapus baris Raw Schedule",halaman:"Raw Schedule",jenis:"delete",table_name:"raw_schedule"});`,
    `if(logActivity) logActivity({admin_nama:user?.name||user?.nama||"Admin",action:"Hapus Raw Schedule",aktivitas:"Hapus baris dari Raw Schedule",jenis:"delete",halaman:"Raw Schedule",table_name:"raw_schedule",user_name:user?.name||user?.nama||"Admin"});`
  ],
  [
    `if(logActivity) logActivity({action:"Tambah Raw Schedule",aktivitas:"Tambah "+addProses+" - "+addPanel+" ke Raw Schedule",halaman:"Raw Schedule",jenis:"create",table_name:"raw_schedule"});`,
    `if(logActivity) logActivity({admin_nama:user?.name||user?.nama||"Admin",action:"Tambah Panel ke Raw Schedule",aktivitas:"Tambah "+addProses+" - "+addPanel+" ke Raw Schedule",jenis:"create",halaman:"Raw Schedule",table_name:"raw_schedule",user_name:user?.name||user?.nama||"Admin"});`
  ],
];

let changed = 0;
for(const [old, fix] of fixes){
  if(content.includes(old)){
    content = content.replace(old, fix);
    changed++;
    console.log('✅ Fixed:', old.slice(0,50)+'...');
  } else {
    console.log('⚠️ Not found:', old.slice(0,50)+'...');
  }
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('\nChanged:', changed, 'patterns');
console.log('Done!');