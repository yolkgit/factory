// data/ksic-tree.json + data/ksic-index.json 을 병합해 public/ksic-data.json 생성.
// terms 는 [code, term] 압축 배열로 저장해 용량을 줄인다.
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const tree = JSON.parse(fs.readFileSync(path.join(dataDir, 'ksic-tree.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'ksic-index.json'), 'utf8'));
const oldnewPath = path.join(dataDir, 'ksic-oldnew.json');
const oldnew = fs.existsSync(oldnewPath) ? JSON.parse(fs.readFileSync(oldnewPath, 'utf8')) : [];
const upjongPath = path.join(dataDir, 'upjong-map.json');
const upjong = fs.existsSync(upjongPath) ? JSON.parse(fs.readFileSync(upjongPath, 'utf8')) : [];
const descPath = path.join(dataDir, 'ksic-desc.json');
const desc = fs.existsSync(descPath) ? JSON.parse(fs.readFileSync(descPath, 'utf8')) : {};
const gyeongbiPath = path.join(dataDir, 'gyeongbi-map.json');
const gyeongbi = fs.existsSync(gyeongbiPath) ? JSON.parse(fs.readFileSync(gyeongbiPath, 'utf8')) : {};

const codes = new Set(tree.map((n) => n.code));
const missing = new Set();
for (const r of index) if (!codes.has(r.code)) missing.add(r.code);
if (missing.size) {
  console.warn('트리에 없는 색인어 코드:', [...missing].slice(0, 20).join(', '), `(${missing.size}종)`);
}

const out = {
  revision: '11차',
  crawledFrom: 'kssc.kostat.go.kr',
  tree: tree.map((n) => [n.code, n.name, n.level, n.parent]),
  terms: index.map((r) => [r.code, r.term]),
  oldnew: oldnew.map((r) => [r.new, r.old, r.oldName]),
  upjong: upjong.map((r) => [r.u, r.un, r.k]),
  desc, // { code: { e: 영문명, d: 설명 } }
  gyeongbi, // { 업종코드: [단순경비율일반, 단순경비율초과, 기준경비율일반] } (2025 귀속)
};

const outPath = path.join(__dirname, '..', 'public', 'ksic-data.json');
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
const kb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`saved ${outPath} (${kb} KB, tree ${tree.length}, terms ${index.length})`);
