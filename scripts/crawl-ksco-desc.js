// 한국표준직업분류(KSCO) 8차 세분류 해설(정의·예시·제외)을 수집한다.
// 입력: data/ksco-tree.json (최하위 레벨), 출력: data/ksco-desc.json { code: {e, d} }
const fs = require('fs');
const path = require('path');

const BASE = 'http://kssc.kostat.go.kr/ksscNew_web';
const NAME_CODE = '002';
const DEGREE = '08';
const DETAIL = BASE + '/kssc/common/IndexedSearchDetail.do';
const CONCURRENCY = 6;

let COOKIE = '';
async function initSession() {
  const r1 = await fetch(`${BASE}/kssc/common/ClassificationContent.do?gubun=1&strCategoryNameCode=${NAME_CODE}`, { signal: AbortSignal.timeout(30000) });
  COOKIE = (r1.headers.get('set-cookie') || '').split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
  await fetch(`${BASE}/kssc/common/IndexedSearchList.do?gubun=1&strCategoryNameCode=${NAME_CODE}&cntGugun=N&searchGugun=N&categoryMenu=006&addGubun=no`,
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

function parseDetail(html) {
  let eng = '';
  const em = html.match(/분류명\(영문\)[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/);
  if (em) eng = em[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  let desc = '';
  const dm = html.match(/설명\(한글\)[\s\S]*?<td[^>]*colspan=["']?3["']?[^>]*>([\s\S]*?)<\/td>/);
  if (dm) {
    desc = dm[1]
      // 통계청 응답은 같은 설명을 HTML 주석으로 한 번 더 담아 보낸다.
      // 주석을 먼저 통째로 걷어내지 않으면 <[^>]*> 규칙이 "<!--...<BR>"까지만 지워
      // 주석 속 본문이 중복으로 남고 끝에 "-->"가 붙는다.
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*(직업예시|예시|제외|주요활동|포함|직무개요|직무\s*개요)\s*>/g, '\n[$1]\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n')
      .split('\n').map((s) => s.trim()).filter(Boolean).join('\n').trim();
  }
  return { e: eng, d: desc };
}

async function fetchDetail(code, name, retry = 4) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(DETAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Cookie: COOKIE },
        body: body(code, name),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseDetail(html);
      if (!parsed.d && !parsed.e) throw new Error('empty parse');
      return parsed;
    } catch (e) {
      if (i === retry - 1) throw new Error(`${code}: ${e.message}`);
      if (String(e.message).includes('session')) await initSession();
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

async function main() {
  await initSession();
  if (!COOKIE) throw new Error('세션 쿠키 발급 실패');
  const dataDir = path.join(__dirname, '..', 'data');
  const tree = JSON.parse(fs.readFileSync(path.join(dataDir, 'ksco-tree.json'), 'utf8'));
  const maxLevel = Math.max(...tree.map((n) => n.level));
  let leaves = tree.filter((n) => n.level === maxLevel);
  // --limit N: 통계청 서버에 전체를 걸기 전에 소량으로 수집·파싱이 되는지 확인한다.
  // --dry: 파일로 저장하지 않고 결과만 출력한다.
  const li = process.argv.indexOf('--limit');
  if (li > -1) leaves = leaves.slice(0, Number(process.argv[li + 1]) || 10);
  const dry = process.argv.includes('--dry');
  console.log(`KSCO 세분류(level ${maxLevel}) ${leaves.length}개 해설 수집 시작${dry ? ' (dry-run)' : ''}`);

  const out = {};
  let idx = 0, done = 0, fail = 0;
  async function worker() {
    while (idx < leaves.length) {
      const n = leaves[idx++];
      try { out[n.code] = await fetchDetail(n.code, n.name); }
      catch (e) { fail++; if (fail <= 5) console.warn('\n실패', e.message); }
      if (++done % 100 === 0) process.stdout.write(`\r${done}/${leaves.length} (실패 ${fail})   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();
  const withDesc = Object.values(out).filter((v) => v.d);
  if (dry) {
    for (const [c, v] of Object.entries(out).slice(0, 3)) console.log(`\n── ${c} (${v.e}) ──\n${v.d}`);
  } else {
    fs.writeFileSync(path.join(dataDir, 'ksco-desc.json'), JSON.stringify(out), 'utf8');
  }
  const avg = withDesc.length ? Math.round(withDesc.reduce((s, v) => s + v.d.length, 0) / withDesc.length) : 0;
  console.log(`\n${dry ? '수집(미저장)' : '저장'}: ${Object.keys(out).length}개, 설명있음 ${withDesc.length}(평균 ${avg}자), 실패 ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
