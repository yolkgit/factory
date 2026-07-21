// 국세청 "2025년 귀속 기준(단순)경비율.xlsx" (업종코드별) 파싱.
// 원본: 국세청 홈페이지 자료실(nts.go.kr) 기준경비율·단순경비율 게시글 첨부.
// 출력: data/gyeongbi-map.json  { 업종코드: [단순경비율일반, 단순경비율초과, 기준경비율일반] }
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dataDir = path.join(__dirname, '..', 'data');
const wb = XLSX.readFile(path.join(dataDir, 'gyeongbi-2025.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// 헤더: 귀속연도, 업종코드, 업태명, 중분류, 세분류, 세세분류, 적용기준내용,
//       단순경비율(일반율), 단순경비율(초과율), 기준경비율(일반율)
const out = {};
let year = '';
for (const r of rows) {
  const u = String(r[1] || '').trim();
  if (!/^\d{6}$/.test(u)) continue;
  year = String(r[0] || year).trim();
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  out[u] = [num(r[7]), num(r[8]), num(r[9])];
}

const outPath = path.join(dataDir, 'gyeongbi-map.json');
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
console.log(`saved ${outPath}: ${Object.keys(out).length}개 업종코드 (${year}년 귀속)`);
