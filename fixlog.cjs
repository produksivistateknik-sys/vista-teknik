const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix logActivity di handleAddWP - action tidak boleh null
const old1 = `    logActivity?.({action:"Tambah "+wp+" ("+komps.length+" komponen) ke Raw Schedule",halaman:"Raw Schedule"});`;
const new1 = `    if(logActivity) logActivity({action:"Tambah "+wp,aktivitas:"Tambah "+wp+" ("+komps.length+" komponen) ke Raw Schedule",halaman:"Raw Schedule",jenis:"update",table_name:"raw_schedule"});`;

if(content.includes(old1)){
  content = content.replace(old1, new1);
  console.log('✅ handleAddWP logActivity fixed');
} else {
  console.log('❌ handleAddWP logActivity not found');
}

// Fix logActivity di handleRemoveWP
const old2 = `    logActivity?.({action:"Hapus Raw Schedule",halaman:"Raw Schedule"});`;
const new2 = `    if(logActivity) logActivity({action:"Hapus Raw Schedule",aktivitas:"Hapus baris Raw Schedule",halaman:"Raw Schedule",jenis:"delete",table_name:"raw_schedule"});`;

if(content.includes(old2)){
  content = content.replace(old2, new2);
  console.log('✅ handleRemoveRow logActivity fixed');
} else {
  // coba cari versi lain
  const old2b = `    logActivity?.({action:"Hapus Raw Schedule",halaman:"Raw Schedule"})`;
  if(content.includes(old2b)){
    content = content.replace(old2b, new2);
    console.log('✅ handleRemoveRow logActivity fixed (v2)');
  } else {
    console.log('❌ handleRemoveRow logActivity not found');
  }
}

// Fix logActivity di handleAddRow (tambah panel)
const old3 = `    logActivity?.({action:"Tambah Raw Schedule "+addProses+" - "+addPanel,halaman:"Raw Schedule"});`;
const new3 = `    if(logActivity) logActivity({action:"Tambah Raw Schedule",aktivitas:"Tambah "+addProses+" - "+addPanel+" ke Raw Schedule",halaman:"Raw Schedule",jenis:"create",table_name:"raw_schedule"});`;

if(content.includes(old3)){
  content = content.replace(old3, new3);
  console.log('✅ handleAddRow logActivity fixed');
} else {
  console.log('❌ handleAddRow logActivity not found');
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('\nDone!');