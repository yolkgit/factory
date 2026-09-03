// IndexNow로 전체 URL 색인 요청(네이버·빙 등 지원 엔진에 즉시 통보).
// 구글은 IndexNow 미지원 → Search Console 사이트맵으로 처리.
// 사용: node scripts/indexnow.js [--limit N]
const fs = require('fs');
const path = require('path');

const SITE = (process.env.SITE_URL || 'https://factory.soritok.com').replace(/\/$/, '');
const HOST = SITE.replace(/^https?:\/\//, '');
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const BATCH = 10000; // IndexNow 1회 최대 10,000 URL

function loadKey() {
  const p = path.join(__dirname, '..', 'data', 'indexnow-key.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')).key;
}

// sections: 제출할 구간 이름 목록(미지정 시 전체). hub=허브 페이지, code/job/keco/upjong=각 섹션 상세
function allUrls(sections) {
  const want = (s) => !sections || sections.includes(s);
  const urls = [];
  if (want('hub')) urls.push(`${SITE}/`, `${SITE}/job`, `${SITE}/keco`, `${SITE}/upjong`, `${SITE}/about`, `${SITE}/privacy`, `${SITE}/terms`);
  // sitemap.xml과 같은 기준(SITEMAP_CODES)을 쓴다. 얇은 페이지는 제출해도 색인되지 않고
  // 사이트 전체 평가만 끌어내리므로, 두 경로에서 서로 다른 목록을 보내지 않도록 맞춘다.
  // SITEMAP_CODES는 렌더 결과 길이로 판정하므로 server.js와 똑같이 의존성을 주입해야 한다.
  const { codepage, jobpage, kecopage, upjongpage } = require('../wire').wireAll();
  if (want('code')) for (const c of codepage.SITEMAP_CODES()) urls.push(`${SITE}/code/${c}`);
  if (want('job')) for (const c of jobpage.SITEMAP_CODES()) urls.push(`${SITE}/job/${c}`);
  if (want('keco')) for (const c of kecopage.SITEMAP_CODES()) urls.push(`${SITE}/keco/${c}`);
  if (want('upjong')) for (const c of upjongpage.SITEMAP_CODES()) urls.push(`${SITE}/upjong/${c}`);
  return urls;
}

async function submit(key, urls) {
  const body = {
    host: HOST,
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: urls,
  };
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await r.text().catch(() => '');
  return { status: r.status, text: text.slice(0, 200) };
}

async function main() {
  const key = loadKey();
  const limitArg = process.argv.indexOf('--limit');
  const secArg = process.argv.indexOf('--section');
  const sections = secArg > -1 ? String(process.argv[secArg + 1] || '').split(',').filter(Boolean) : null;
  let urls = allUrls(sections);
  if (limitArg > -1) urls = urls.slice(0, Number(process.argv[limitArg + 1]) || 100);
  if (!urls.length) { console.error('제출할 URL이 없습니다. --section 값 확인: hub,code,job,keco,upjong'); process.exit(1); }
  console.log(`IndexNow 제출: ${urls.length.toLocaleString()}개 URL (host ${HOST}${sections ? `, 구간 ${sections.join(',')}` : ''})`);
  // --dry: 실제 제출 없이 대상 수만 확인한다(sitemap.xml과 개수가 맞는지 대조할 때 쓴다)
  if (process.argv.includes('--dry')) {
    for (const u of urls.slice(0, 3)) console.log(`  ${u}`);
    console.log(`  ... (dry-run, 제출하지 않음)`);
    return;
  }

  for (let i = 0; i < urls.length; i += BATCH) {
    const chunk = urls.slice(i, i + BATCH);
    let res = await submit(key, chunk);
    // 200/202 = 접수됨, 400=형식오류, 403=키검증 실패/진행중, 422=URL·호스트 불일치, 429=과다요청
    // 신규 사이트는 키 검증에 시간이 걸려 403(SiteVerificationNotCompleted)이 날 수 있어 재시도한다.
    for (let t = 1; t <= 5 && res.status === 403 && /VerificationNotCompleted/i.test(res.text); t++) {
      const wait = 30 * t;
      console.log(`  키 검증 진행 중 — ${wait}초 후 재시도 (${t}/5)`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await submit(key, chunk);
    }
    console.log(`  ${i + 1}~${i + chunk.length}: HTTP ${res.status} ${res.text}`);
    if (res.status === 403) {
      console.error('키 검증이 아직 완료되지 않았습니다. 키 파일은 배포돼 있으니 잠시 후 다시 실행하세요:');
      console.error(`  ${SITE}/${key}.txt`);
      process.exit(1);
    }
  }
  console.log('완료. 네이버·빙 등 IndexNow 지원 엔진에 통보되었습니다(구글은 미지원).');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
