// 홈택스 "업종코드-11차 표준산업분류 연계표" 엑셀(data/upjong-ksic.xlsx)을 파싱해
// data/upjong-map.json 생성: [{ u: 업종코드6, un: 업종명, k: KSIC5 }]
// 원본: https://teht.hometax.go.kr (업종코드-표준산업분류 연계표, 홈택스 게시)
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dataDir = path.join(__dirname, '..', 'data');
const wb = XLSX.readFile(path.join(dataDir, 'upjong-ksic.xlsx'));
const ws = wb.Sheets['연계표'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// 데이터 행: [null, 일련번호, 업종코드, ..., col11=업종세세분류명, col12=연계, col13=KSIC5, ..., col22=KSIC세세분류명]
const out = [];
for (const r of rows) {
  const u = String(r[2] || '').trim();
  const k = String(r[13] || '').trim();
  if (!/^\d{6}$/.test(u) || !/^\d{5}$/.test(k)) continue;
  const un = String(r[11] || r[10] || '').trim();
  out.push({ u, un, k });
}

const uniq = new Set(out.map((r) => r.u));
const outPath = path.join(dataDir, 'upjong-map.json');
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
console.log(`saved ${outPath}: ${out.length} rows, ${uniq.size} upjong codes`);
