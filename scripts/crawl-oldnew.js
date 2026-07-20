// 통계청 KSSC 신구연계검색에서 KSIC 11차 ↔ 10차 코드 연계표를 수집한다.
// 입력: data/ksic-tree.json (세세분류 코드 목록)
// 출력: data/ksic-oldnew.json  [{ new, old, oldName }]
const fs = require('fs');
const path = require('path');

const URL = 'http://kssc.kostat.go.kr/ksscNew_web/kssc/common/ConnectionTableSearchMainTreeListView.do';
const BATCH = 20;
const CONCURRENCY = 6;

function body(codes) {
  return (
    'strCategoryNameCode=001&strCategoryDegree=11&pageIndex=0&categoryMenu=008' +
    '&strCategoryLevel=050&strOldRelationGubun=2' +
    `&strCategoryCodeList=${codes.join(',')}`
  );
}

function parseRows(html) {
  const block = html.match(/mainTreeListView\s*=\s*\[([\s\S]*?)\];/);
  if (!block) return null;
  const rows = [];
  const re = /\{\s*"strNewCategoryCode":\s*"([^"]*)"\s*,\s*"strNewCategoryCodeName":\s*"([^"]*)"\s*,\s*"strNewCategoryDegree":\s*"([^"]*)"\s*,\s*"strOldCategoryCode":\s*"([^"]*)"\s*,\s*"strOldCategoryCodeName":\s*"([^"]*)"\s*,\s*"strOldCategoryDegree":\s*"([^"]*)"\s*\}/g;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    rows.push({
      newCode: m[1], newName: m[2], newDegree: m[3],
      oldCode: m[4], oldName: m[5], oldDegree: m[6],
    });
  }
  return rows;
}

async function fetchBatch(codes, retry = 4) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body(codes),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseRows(await res.text());
      if (rows === null || rows.length === 0) throw new Error('empty response');
      return rows;
    } catch (e) {
      if (i === retry - 1) throw new Error(`batch ${codes[0]}..: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function main() {
  const tree = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'ksic-tree.json'), 'utf8')
  );
  const leaves = tree.filter((n) => n.level === 5).map((n) => n.code);
  const batches = [];
  for (let i = 0; i < leaves.length; i += BATCH) batches.push(leaves.slice(i, i + BATCH));
  console.log(`codes: ${leaves.length}, batches: ${batches.length}`);

  const all = [];
  let idx = 0, done = 0;
  async function worker() {
    while (idx < batches.length) {
      const b = batches[idx++];
      const rows = await fetchBatch(b);
      all.push(...rows);
      done++;
      process.stdout.write(`\rbatches: ${done}/${batches.length}   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();

  // 11차(new) ← 10차(old) 행만 사용
  const seen = new Set();
  const out = [];
  for (const r of all) {
    if (r.newDegree !== '11' || !r.newCode || !r.oldCode) continue;
    const k = r.newCode + '|' + r.oldCode;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ new: r.newCode, old: r.oldCode, oldName: r.oldName });
  }
  const covered = new Set(out.map((r) => r.new));
  const missing = leaves.filter((c) => !covered.has(c));
  if (missing.length) console.warn(`연계 정보 없는 코드 ${missing.length}개:`, missing.slice(0, 10).join(', '));

  const outPath = path.join(__dirname, '..', 'data', 'ksic-oldnew.json');
  fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
  console.log(`saved ${outPath}: ${out.length} pairs, covered ${covered.size}/${leaves.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
