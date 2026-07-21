// 통계청 분류내용보기(해설서) IndexedSearchDetail.do 에서 세세분류(5자리)별
// 영문명 + 설명(정의·예시·제외)을 수집한다.
// 입력: data/ksic-tree.json (level 5 코드)
// 출력: data/ksic-desc.json  { code: { e: 영문명, d: 설명텍스트 } }
const fs = require('fs');
const path = require('path');

const BASE = 'http://kssc.kostat.go.kr/ksscNew_web';
const DETAIL = BASE + '/kssc/common/IndexedSearchDetail.do';
const CONCURRENCY = 6;

let COOKIE = '';

async function initSession() {
  // 세션 쿠키 발급: 분류내용 페이지 → 검색 페이지 순으로 접근
  const r1 = await fetch(
    BASE + '/kssc/common/ClassificationContent.do?gubun=1&strCategoryNameCode=001',
    { signal: AbortSignal.timeout(30000) }
  );
  const setCookie = r1.headers.get('set-cookie') || '';
  COOKIE = setCookie.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
  await fetch(
    BASE + '/kssc/common/IndexedSearchList.do?gubun=1&strCategoryNameCode=001&cntGugun=N&searchGugun=N&categoryMenu=006&addGubun=no',
    { headers: { Cookie: COOKIE }, signal: AbortSignal.timeout(30000) }
  );
}

function detailBody(code, name) {
  const p = new URLSearchParams();
  p.set('categoryNameCode', '001');
  p.set('categoryType', '001');
  p.set('categoryMenu', '006');
  p.set('categoryCode', code);
  p.set('categoryCodeName', name);
  p.set('categoryDegree', '11');
  p.set('searchGugun', 'Y');
  p.set('detailCheck', 'Y');
  p.set('listCheck', '0');
  p.set('strCategoryDegree', '11');
  p.set('strCategoryType', '0');
  p.set('strSearchGugun', '1');
  p.set('strCategoryCodeName', '');
  p.set('pageIndex', '1');
  return p.toString();
}

function parseDetail(html) {
  // 영문명
  let eng = '';
  const em = html.match(/분류명\(영문\)[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/);
  if (em) eng = em[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // 설명(한글): 첫 번째 <td colspan="3"> 블록
  let desc = '';
  const dm = html.match(/설명\(한글\)[\s\S]*?<td[^>]*colspan=["']?3["']?[^>]*>([\s\S]*?)<\/td>/);
  if (dm) {
    desc = dm[1]
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1') // 제외 코드 링크는 코드 텍스트만 남김
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      // 섹션 라벨(<예시>,<제외>,<주요활동> 등)은 태그처럼 보이므로 먼저 마커로 치환
      .replace(/<\s*(예시|제외|주요활동|포함|주요\s*활동)\s*>/g, '\n[$1]\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .split('\n').map((s) => s.trim()).filter(Boolean).join('\n')
      .trim();
  }
  return { e: eng, d: desc };
}

async function fetchDetail(code, name, retry = 4) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(DETAIL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: COOKIE,
        },
        body: detailBody(code, name),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.includes('세션이 종료') || html.includes('CnsmrIdLoginPage')) {
        if (html.includes('분류명(영문)') === false) throw new Error('session/error page');
      }
      const parsed = parseDetail(html);
      if (!parsed.d && !parsed.e) throw new Error('empty parse');
      return parsed;
    } catch (e) {
      if (i === retry - 1) throw new Error(`${code}: ${e.message}`);
      // 세션 만료 가능성 → 재발급
      if (String(e.message).includes('session')) await initSession();
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

async function main() {
  await initSession();
  if (!COOKIE) throw new Error('세션 쿠키 발급 실패');

  const tree = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'ksic-tree.json'), 'utf8')
  );
  const leaves = tree.filter((n) => n.level === 5);
  console.log(`세세분류 ${leaves.length}개 해설 수집 시작`);

  const out = {};
  let idx = 0, done = 0, fail = 0;
  async function worker() {
    while (idx < leaves.length) {
      const n = leaves[idx++];
      try {
        out[n.code] = await fetchDetail(n.code, n.name);
      } catch (e) {
        fail++;
        if (fail <= 10) console.warn('\n실패', e.message);
      }
      done++;
      if (done % 50 === 0) process.stdout.write(`\r${done}/${leaves.length} (실패 ${fail})   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();

  const outPath = path.join(__dirname, '..', 'data', 'ksic-desc.json');
  fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
  const withDesc = Object.values(out).filter((v) => v.d).length;
  console.log(`saved ${outPath}: ${Object.keys(out).length}개, 설명있음 ${withDesc}, 실패 ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
