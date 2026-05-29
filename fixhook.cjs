const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Hapus useState dari posisi salah (setelah kondisi)
const wrong = "  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;\n  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);";
const correct = "  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;";
let fixed = content.replace(wrong, correct);

// Tambahkan useState setelah deklarasi tab state
const tabState = "  const [tab,setTab]=useState(\"dashboard\");";
const tabStateNew = "  const [tab,setTab]=useState(\"dashboard\");\n  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);";
fixed = fixed.replace(tabState, tabStateNew);

fs.writeFileSync('src/App.tsx', fixed, 'utf8');
console.log('✅ useState dipindah ke posisi benar!');