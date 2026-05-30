const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const wrong = `          </div>\n            ):(\n        <div className="erp-wrap">`;
const correct = `          </div>\n        </div>\n      ):(\n        <div className="erp-wrap">`;

if(content.includes(wrong)){
  const fixed = content.replace(wrong, correct);
  fs.writeFileSync('src/App.tsx', fixed, 'utf8');
  console.log('✅ Fix berhasil!');
} else {
  console.log('❌ Pattern tidak cocok');
  const idx = content.indexOf('"erp-wrap"');
  console.log(JSON.stringify(content.slice(idx-200, idx+20)));
}