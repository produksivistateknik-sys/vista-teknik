const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const searchSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`;
const searchSvgSafe = `url('%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22%3E%3Ccircle cx=%2211%22 cy=%2211%22 r=%228%22/%3E%3Cpath d=%22m21 21-4.35-4.35%22/%3E%3C/svg%3E')`;

let count = 0;
while(content.includes(searchSvg)){
  content = content.replace(searchSvg, searchSvgSafe);
  count++;
}
console.log('Replaced:', count, 'instances');
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('✅ Done!');