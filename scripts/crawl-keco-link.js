// 한국고용직업분류(KECO 2025) 코드별 "한국표준직업분류(KSCO) 연계코드"를 수집한다.
// 통계청은 KECO에 대해서는 해설(정의·예시)을 주지 않고 KSCO 연계코드만 제공한다.
// 입력: data/keco-tree.json, 출력: data/keco-link.json { kecoCode: [{ code, name }] }
// 사용: node scripts/crawl-keco-link.js [--limit N] [--dry]
const fs = require('fs');
const path = require('path');

const BASE = 'http://kssc.kostat.go.kr/ksscNew_web';
const NAME_CODE = '038'; // 한국고용직업분류
const DEGREE = '2025';
const DETAIL = BASE + '/kssc/common/IndexedSearchDetail.do';
const CONCURRENCY = 5;

let COOKIE = '';
async function initSession() {
  const r1 = await fetch(`${BASE}/kssc/common/ClassificationContent.do?gubun=2&strCategoryNameCode=${NAME_CODE}`, { signal: AbortSignal.timeout(30000) });
  COOKIE = (r1.headers.get('set-cookie') || '').split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
  await fetch(`${BASE}/kssc/common/IndexedSearchList.do?gubun=2&strCategoryNameCode=${NAME_CODE}&cntGugun=N&searchGugun=N&categoryMenu=006&addGubun=no`,
    { headers: { Cookie: COOKIE }, signal: AbortSignal.timeout(30000) });
}

function body(code, name) {
  const p = new URLSearchParams();
  p.set('categoryNameCode', NAME_CODE); p.set('categoryType', '001'); p.set('categoryMenu', '006');
  p.set('categoryCode', code); p.set('categoryCodeName', name); p.set('categoryDegree', DEGREE);
  p.set('searchGugun', 'Y'); p.set('detailCheck', 'Y'); p.set('listCheck', '0');
  p.set('strCategoryDegree', DEGREE); p.set('strCategoryType', '0'); p.set('strSearchGugun', '1');
  p.set('strCategoryCodeName', ''); p.set('pageIndex', '1');
  return p.toString();
}

// "* 한국표준직업분류 연계코드: 1111 의회 의원" 형태에서 코드·이름 쌍을 뽑는다.
// 하나의 KECO 코드에 여러 KSCO 코드가 붙는 경우가 있어 전부 수집한다.
function parseLinks(html) {
  const dm = html.match(/설명\(한글\)[\s\S]*?<td[^>]*colspan=["']?3["']?[^>]*>([\s\S]*?)<\/td>/);
  if (!dm) return [];
  const text = dm[1]
    .replace(/<!--[\s\S]*?-->/g, '') // 통계청 응답은 같은 내용을 주석으로 한 번 더 담아 보낸다
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/‧/g, '·') // 원문에 가운뎃점 변형(‧)이 섞여 나온다
    .trim();
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(/(\d{4})\s+([^\n,]+)/g)) {
    const code = m[1];
    const name = m[2].replace(/\s+/g, ' ').trim();
    if (!name || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name });
  }
  return out;
}

async function fetchLinks(code, name, retry = 4) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(DETAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Cookie: COOKIE },
        body: body(code, name),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseLinks(await res.text());
    } catch (e) {
      if (i === retry - 1) throw new Error(`${code}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

async function main() {
  await initSession();
  if (!COOKIE) throw new Error('세션 쿠키 발급 실패');
  const dataDir = path.join(__dirname, '..', 'data');
  const tree = JSON.parse(fs.readFileSync(path.join(dataDir, 'keco-tree.json'), 'utf8'));
  const maxLevel = Math.max(...tree.map((n) => n.level));
  let leaves = tree.filter((n) => n.level === maxLevel);

  const li = process.argv.indexOf('--limit');
  if (li > -1) leaves = leaves.slice(0, Number(process.argv[li + 1]) || 10);
  const dry = process.argv.includes('--dry');
  console.log(`KECO 세분류(level ${maxLevel}) ${leaves.length}개 KSCO 연계코드 수집${dry ? ' (dry-run)' : ''}`);

  const out = {};
  let idx = 0, done = 0, fail = 0;
  async function worker() {
    while (idx < leaves.length) {
      const n = leaves[idx++];
      try {
        const links = await fetchLinks(n.code, n.name);
        if (links.length) out[n.code] = links;
      } catch (e) {
        fail++;
        if (fail <= 5) console.warn('\n실패', e.message);
      }
      if (++done % 50 === 0) process.stdout.write(`\r${done}/${leaves.length} (실패 ${fail})   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();

  const total = Object.values(out).reduce((s, a) => s + a.length, 0);
  if (dry) {
    for (const [c, v] of Object.entries(out).slice(0, 5)) console.log(`  ${c} → ${v.map((x) => x.code + ' ' + x.name).join(' / ')}`);
  } else {
    fs.writeFileSync(path.join(dataDir, 'keco-link.json'), JSON.stringify(out), 'utf8');
  }
  console.log(`${dry ? '수집(미저장)' : '저장'}: ${Object.keys(out).length}개 코드, 연계 ${total}건, 실패 ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
