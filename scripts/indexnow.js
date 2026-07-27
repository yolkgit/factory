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

function allUrls() {
  const codepage = require('../codepage');
  const jobpage = require('../jobpage');
  const urls = [`${SITE}/`, `${SITE}/job`];
  for (const c of codepage.CODES_ALL()) urls.push(`${SITE}/code/${c}`);
  for (const c of jobpage.CODES_ALL()) urls.push(`${SITE}/job/${c}`);
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
  let urls = allUrls();
  if (limitArg > -1) urls = urls.slice(0, Number(process.argv[limitArg + 1]) || 100);
  console.log(`IndexNow 제출: ${urls.length.toLocaleString()}개 URL (host ${HOST})`);

  for (let i = 0; i < urls.length; i += BATCH) {
    const chunk = urls.slice(i, i + BATCH);
    const res = await submit(key, chunk);
    // 200/202 = 접수됨, 400=형식오류, 403=키불일치, 422=URL/호스트 불일치, 429=과다요청
    console.log(`  ${i + 1}~${i + chunk.length}: HTTP ${res.status} ${res.text}`);
    if (res.status === 403) throw new Error('키 검증 실패 — 키 파일이 사이트 루트에 배포됐는지 확인하세요.');
  }
  console.log('완료. 네이버·빙 등 IndexNow 지원 엔진에 통보되었습니다(구글은 미지원).');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
