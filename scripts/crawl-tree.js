// 통계청 KSSC 분류내용보기 트리에서 한국표준산업분류(KSIC) 11차 전체 계층을 수집한다.
// 출력: data/ksic-tree.json  [{ code, name, level, parent }]
const fs = require('fs');
const path = require('path');

const BASE = 'http://kssc.kostat.go.kr/ksscNew_web/kssc/common/ClassificationContentMainTreeList.do';
const PARAMS = 'strCategoryNameCode=001&strCategoryDegree=11&strCategoryCode=&strCategoryCodeName=';
const CONCURRENCY = 6;

async function fetchChildren(rootId, retry = 3) {
  const url = `${BASE}?${PARAMS}&root=${encodeURIComponent(rootId)}`;
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const items = JSON.parse(text);
      return items.map((it) => {
        const plain = it.text.replace(/<[^>]*>/g, '').trim();
        const m = plain.match(/^([A-Z0-9]+)\.(.+)$/);
        return {
          code: it.id,
          name: m ? m[2].trim() : plain,
          hasChildren: !!it.hasChildren,
        };
      });
    } catch (e) {
      if (i === retry - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function main() {
  const nodes = [];
  let queue = [{ id: 'source', level: 0 }];
  while (queue.length) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (parent) => {
        const children = await fetchChildren(parent.id);
        return { parent, children };
      })
    );
    for (const { parent, children } of results) {
      for (const c of children) {
        nodes.push({
          code: c.code,
          name: c.name,
          level: parent.level + 1,
          parent: parent.id === 'source' ? null : parent.id,
        });
        if (c.hasChildren) queue.push({ id: c.code, level: parent.level + 1 });
      }
    }
    process.stdout.write(`\rnodes: ${nodes.length}, queue: ${queue.length}   `);
  }
  console.log();
  const out = path.join(__dirname, '..', 'data', 'ksic-tree.json');
  fs.writeFileSync(out, JSON.stringify(nodes, null, 1), 'utf8');
  const byLevel = nodes.reduce((a, n) => ((a[n.level] = (a[n.level] || 0) + 1), a), {});
  console.log('saved', out, 'levels:', JSON.stringify(byLevel));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
