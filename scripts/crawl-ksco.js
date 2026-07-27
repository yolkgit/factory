// 통계청 KSSC에서 한국표준직업분류(KSCO) 8차 계층 + 색인어를 수집한다.
// 출력: data/ksco-tree.json [{code,name,level,parent}], data/ksco-index.json [{code,term}]
const fs = require('fs');
const path = require('path');

const BASE = 'http://kssc.kostat.go.kr/ksscNew_web';
const NAME_CODE = '002'; // 한국표준직업분류
const DEGREE = '08'; // 8차(현행)
const TREE_URL = `${BASE}/kssc/common/ClassificationContentMainTreeList.do`;
const LIST_URL = `${BASE}/kssc/common/IndexedSearchList.do?gubun=1&addGubun=no&strCategoryNameCode=${NAME_CODE}`;
const CONCURRENCY = 6;
const PER_PAGE = 10;

/* ---------- 계층 트리 ---------- */
async function fetchChildren(rootId, retry = 3) {
  const url = `${TREE_URL}?strCategoryNameCode=${NAME_CODE}&strCategoryDegree=${DEGREE}&strCategoryCode=&strCategoryCodeName=&root=${encodeURIComponent(rootId)}`;
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = JSON.parse(await res.text());
      return items.map((it) => {
        const plain = it.text.replace(/<[^>]*>/g, '').trim();
        const m = plain.match(/^([A-Z0-9]+)\.(.+)$/);
        return { code: it.id, name: m ? m[2].trim() : plain, hasChildren: !!it.hasChildren };
      });
    } catch (e) {
      if (i === retry - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function crawlTree() {
  const nodes = [];
  let queue = [{ id: 'source', level: 0 }];
  while (queue.length) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map(async (parent) => ({ parent, children: await fetchChildren(parent.id) })));
    for (const { parent, children } of results) {
      for (const c of children) {
        nodes.push({ code: c.code, name: c.name, level: parent.level + 1, parent: parent.id === 'source' ? null : parent.id });
        if (c.hasChildren) queue.push({ id: c.code, level: parent.level + 1 });
      }
    }
    process.stdout.write(`\r[트리] nodes: ${nodes.length}, queue: ${queue.length}   `);
  }
  console.log();
  return nodes;
}

/* ---------- 색인어 ---------- */
function listBody(pageIndex) {
  return (
    `categoryNameCode=${NAME_CODE}&categoryType=001&categoryMenu=006&searchGugun=Y&detailCheck=Y` +
    `&listCheck=0&strCategoryDegree=${DEGREE}&strCategoryType=2&strSearchGugun=1&strCategoryCodeName=` +
    `&pageIndex=${pageIndex}`
  );
}
function parseList(html) {
  const totalM = html.match(/total\s*:\s*([\d,]+)/);
  const total = totalM ? parseInt(totalM[1].replace(/,/g, ''), 10) : null;
  const rows = [];
  const trRe = /fn_Detail\('[^']*','(\d+)','([^']*)','\d+'\);?"\s*>\s*([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const tds = [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) =>
      t[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    );
    if (tds.length >= 3) rows.push({ code: m[1], term: tds[2] });
  }
  return { total, rows };
}
async function fetchListPage(pageIndex, retry = 8) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(LIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: listBody(pageIndex),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseList(await res.text());
      if (parsed.rows.length === 0) throw new Error('empty rows');
      return parsed;
    } catch (e) {
      if (i === retry - 1) {
        // 서버 간헐 실패로 한 페이지를 못 받아도 전체를 중단하지 않는다(해당 페이지만 비움)
        console.warn(`\n[경고] page ${pageIndex} 수집 실패(건너뜀): ${e.message}`);
        return { total: null, rows: [] };
      }
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}
async function crawlIndex() {
  const first = await fetchListPage(1);
  if (!first.total) throw new Error('total 파싱 실패');
  const totalPages = Math.ceil(first.total / PER_PAGE);
  console.log(`[색인어] total ${first.total}, pages ${totalPages}`);
  const all = new Array(totalPages);
  all[0] = first.rows;
  let page = 2, done = 1;
  async function worker() {
    while (page <= totalPages) {
      const p = page++;
      all[p - 1] = (await fetchListPage(p)).rows;
      if (++done % 100 === 0) process.stdout.write(`\r[색인어] ${done}/${totalPages}   `);
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  console.log();
  const seen = new Set();
  const dedup = [];
  for (const r of all.flat()) {
    const k = r.code + '|' + r.term;
    if (!seen.has(k)) { seen.add(k); dedup.push(r); }
  }
  return dedup;
}

async function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  const treePath = path.join(dataDir, 'ksco-tree.json');
  // 이미 수집된 트리가 있으면 재사용(색인어만 재시도할 때 서버 부하·시간 절약)
  let tree;
  if (process.argv.includes('--index-only') && fs.existsSync(treePath)) {
    tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
    console.log('트리 재사용:', tree.length);
  } else {
    tree = await crawlTree();
    fs.writeFileSync(treePath, JSON.stringify(tree, null, 1), 'utf8');
    const byLevel = tree.reduce((a, n) => ((a[n.level] = (a[n.level] || 0) + 1), a), {});
    console.log('트리 저장:', tree.length, JSON.stringify(byLevel));
  }

  const index = await crawlIndex();
  fs.writeFileSync(path.join(dataDir, 'ksco-index.json'), JSON.stringify(index), 'utf8');
  console.log('색인어 저장:', index.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
