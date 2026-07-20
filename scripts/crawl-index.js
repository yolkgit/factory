// 통계청 KSSC 분류검색(IndexedSearchList.do)에서 KSIC 11차 색인어 전체를 수집한다.
// 빈 검색어로 조회하면 전체 색인어가 페이지당 10건씩 반환된다.
// 출력: data/ksic-index.json  [{ code, term, itemName }]
const fs = require('fs');
const path = require('path');

const URL = 'http://kssc.kostat.go.kr/ksscNew_web/kssc/common/IndexedSearchList.do?gubun=1&addGubun=no&strCategoryNameCode=001';
const CONCURRENCY = 8;
const PER_PAGE = 10;

function body(pageIndex) {
  return (
    'categoryNameCode=001&categoryType=001&categoryMenu=006&searchGugun=Y&detailCheck=Y' +
    '&listCheck=0&strCategoryDegree=11&strCategoryType=2&strSearchGugun=1&strCategoryCodeName=' +
    `&pageIndex=${pageIndex}`
  );
}

async function fetchPage(pageIndex, retry = 4) {
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body(pageIndex),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parsePage(html);
      // HTTP 200이지만 오류/빈 페이지가 오는 경우가 있어 행 0개면 재시도
      if (parsed.rows.length === 0) throw new Error('empty rows');
      return parsed;
    } catch (e) {
      if (i === retry - 1) throw new Error(`page ${pageIndex}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

function parsePage(html) {
  const totalM = html.match(/total\s*:\s*([\d,]+)/);
  const total = totalM ? parseInt(totalM[1].replace(/,/g, ''), 10) : null;
  const rows = [];
  // 행: <tr ... onclick="...fn_Detail('...','01110','곡물 및 기타 식량작물 재배업','11');"> ... <td>번호</td><td>코드</td><td>색인어</td><td>대분류</td>
  const trRe = /fn_Detail\('[^']*','(\d{5})','([^']*)','\d+'\);?"\s*>\s*([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const code = m[1];
    const itemName = m[2].trim();
    const tds = [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) =>
      t[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    );
    // tds: [번호, 분류코드, 색인어, 대분류]
    if (tds.length >= 3) rows.push({ code, term: tds[2], itemName });
  }
  return { total, rows };
}

async function main() {
  const first = await fetchPage(1);
  if (!first.total) throw new Error('total 파싱 실패');
  const totalPages = Math.ceil(first.total / PER_PAGE);
  console.log(`total terms: ${first.total}, pages: ${totalPages}`);

  const all = new Array(totalPages);
  all[0] = first.rows;
  let done = 1;
  let page = 2;
  async function worker() {
    while (page <= totalPages) {
      const p = page++;
      const { rows } = await fetchPage(p);
      all[p - 1] = rows;
      done++;
      if (done % 50 === 0) process.stdout.write(`\rpages: ${done}/${totalPages}   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log();

  const flat = all.flat();
  // 페이지 경계 중복/누락 검출용
  const seen = new Set();
  const dedup = [];
  for (const r of flat) {
    const k = r.code + '|' + r.term;
    if (!seen.has(k)) {
      seen.add(k);
      dedup.push(r);
    }
  }
  const out = path.join(__dirname, '..', 'data', 'ksic-index.json');
  fs.writeFileSync(out, JSON.stringify(dedup), 'utf8');
  console.log(`saved ${out}: raw ${flat.length}, dedup ${dedup.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
