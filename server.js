const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// SEO용 정식 사이트 주소(도메인 확정 시 .env의 SITE_URL 설정). 미설정 시 요청 호스트 사용.
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
function siteUrl(req) {
  if (SITE_URL) return SITE_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${req.headers.host}`;
}
const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const codepage = require('./codepage');
const jobpage = require('./jobpage');
jobpage.setAdSlot(codepage.adSlotHtml); // 광고 슬롯 공유
jobpage.setSidebars(codepage.sidebarsHtml, codepage.SIDEBAR_CSS); // 사이드바 공유
const kecopage = require('./kecopage');
kecopage.setDeps(codepage.adSlotHtml, codepage.SIDEBAR_CSS);

// 한국산업단지공단 공장등록생산정보조회서비스 (data.go.kr 오픈API)
// FACTORY_API_KEY: data.go.kr에서 발급받은 '일반 인증키(Decoding)'를 환경변수로 주입
const FACTORY_KEY = process.env.FACTORY_API_KEY || '';
const FACTORY_BASE = 'https://apis.data.go.kr/B550624/fctryRegistInfo';
// 전국등록공장현황 파일데이터(업종코드 포함) odcloud API — 업종코드로 기업 조회에 사용
// data.go.kr 데이터셋 15105482 활용신청 시 같은 인증키로 동작
// 전국등록공장현황 파일데이터(odcloud). 데이터셋이 연 1회 갱신되면 scripts/check-factory-dataset.js가
// data/factory-dataset.json에 최신 uddi를 기록하고, 아래에서 그 값을 우선 사용한다.
const FACTORY_DATASET = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'factory-dataset.json'), 'utf8'));
    if (j && typeof j.uddi === 'string' && j.uddi.startsWith('uddi:')) return j;
  } catch (e) { /* 파일 없으면 기본값 사용 */ }
  return { uddi: 'uddi:67329811-dbc4-4c82-b3b1-9e6f25721e6e', total: null };
})();
const COMPANY_BASE = `https://api.odcloud.kr/api/15105482/v1/${FACTORY_DATASET.uddi}`;

app.use(compression());

// 공장 조회 프록시: 인증키를 서버에만 보관하고 클라이언트에는 노출하지 않는다
app.get('/api/factory', async (req, res) => {
  if (!FACTORY_KEY) {
    return res.status(503).json({
      ok: false,
      reason: 'no_key',
      message: '공장조회 API 인증키가 설정되지 않았습니다. 서버에 FACTORY_API_KEY 환경변수를 설정하세요.',
    });
  }
  const { cmpnyNm = '', mainProductCn = '', rprsntvNm = '', adres = '', pageNo = '1', numOfRows = '20' } = req.query;
  // 이 오픈API는 회사명(cmpnyNm)을 필수 앵커로 요구한다(생산품·대표자·지역은 선택 필터).
  if (!cmpnyNm) {
    return res.status(400).json({ ok: false, reason: 'need_company', message: '회사명을 입력하세요. (공개 API는 회사명 기준으로 조회합니다)' });
  }
  const qs = new URLSearchParams({
    serviceKey: FACTORY_KEY,
    type: 'JSON',
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    cmpnyNm,
  });
  if (mainProductCn) qs.set('mainProductCn', mainProductCn);
  if (rprsntvNm) qs.set('rprsntvNm', rprsntvNm);
  if (adres) qs.set('adres', adres);

  try {
    const url = `${FACTORY_BASE}/getFctryPrdctnService_v2?${qs}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // 인증키 오류 등은 XML로 반환되는 경우가 있음
      return res.status(502).json({ ok: false, reason: 'bad_response', message: text.slice(0, 400) });
    }
    const body = data.response?.body || {};
    const rawItems = body.items?.item ?? body.items ?? [];
    const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).filter(Boolean).map((it) => ({
      cmpnyNm: it.cmpnyNm || '',
      rprsntvNm: it.rprsntvNm || '',
      indutyNm: it.indutyNm || '',
      indutyCodes: it.indutyCodes || '',
      mainProductCn: it.mainProductCn || '',
      irsttNm: it.irsttNm || '',
      adres: it.rnAdres || it.adres || '',
      fctryManageNo: it.fctryManageNo || '',
      // 상세(공장등록생산정보 API 제공 필드)
      tel: it.cmpnyTelno || '',
      fax: it.cmpnyFxnum || '',
      emp: it.allEmplyCo || '',
      firstRegistDe: it.frstFctryRegistDe || '',
      mgmtOrg: it.cvplChrgOrgnztNm || '',
      homepage: it.hmpadr || '',
      repIndutyCode: it.rprsntvIndutyCode || '',
    }));
    res.json({
      ok: true,
      totalCount: Number(body.totalCount || items.length),
      pageNo: Number(body.pageNo || pageNo),
      numOfRows: Number(body.numOfRows || numOfRows),
      items,
    });
  } catch (e) {
    res.status(502).json({ ok: false, reason: 'fetch_error', message: String(e.message || e) });
  }
});

// 산업분류코드(업종코드)로 기업 조회 — 전국등록공장현황 odcloud API
app.get('/api/company', async (req, res) => {
  if (!FACTORY_KEY) {
    return res.status(503).json({ ok: false, reason: 'no_key', message: '인증키가 설정되지 않았습니다.' });
  }
  const { indutyCode = '', cmpnyNm = '', sido = '', product = '', material = '', pageNo = '1', perPage = '20' } = req.query;
  if (!indutyCode && !cmpnyNm && !product && !material) {
    return res.status(400).json({ ok: false, reason: 'no_query', message: '업종코드·회사명·생산품 중 하나 이상 입력하세요.' });
  }
  const qs = new URLSearchParams({ serviceKey: FACTORY_KEY, page: String(pageNo), perPage: String(perPage) });
  // 이 데이터셋은 10차 산업분류 '대표업종' 코드로 필터. 클라이언트가 11차→10차 변환해 전달.
  // (업종코드 필드는 복수 코드가 천단위 콤마로 합쳐져 있어 LIKE 매칭이 불가능하므로 대표업종::EQ 사용)
  if (indutyCode) qs.append('cond[대표업종::EQ]', indutyCode);
  if (cmpnyNm) qs.append('cond[회사명::LIKE]', cmpnyNm);
  if (sido) qs.append('cond[시도명::LIKE]', sido);
  if (product) qs.append('cond[생산품::LIKE]', product);
  if (material) qs.append('cond[원자재::LIKE]', material);
  try {
    const r = await fetch(`${COMPANY_BASE}?${qs}`, { signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ ok: false, reason: 'bad_response', message: text.slice(0, 300) }); }
    if (data.code && data.code < 0) {
      // odcloud 오류(미등록 키 등)
      const reason = /등록되지 않은/.test(data.msg || '') ? 'dataset_not_activated' : 'api_error';
      return res.status(502).json({ ok: false, reason, message: data.msg || '조회 실패' });
    }
    const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
    const items = (data.data || []).map((r) => ({
      cmpnyNm: r['회사명'] || '',
      rprsntvNm: '',
      indutyNm: r['업종명'] || '',
      // 업종코드 필드는 복수코드가 콤마로 합쳐져 있어 신뢰불가 → 대표업종(단일 10차 코드) 사용
      indutyCodes: r['대표업종'] != null ? String(r['대표업종']) : '',
      mainProductCn: r['생산품'] || '',
      irsttNm: r['단지명'] || '',
      adres: r['공장주소'] || r['공장주소_지번'] || '',
      jibunAdres: r['공장주소_지번'] || '',
      corpAdres: r['법인주소'] || '',
      sido: r['시도명'] || '',
      sigungu: r['시군구명'] || '',
      emp: r['종업원합계'] || '',
      // 상세 정보
      material: r['원자재'] || '',
      tel: r['전화번호'] || '',
      scale: r['공장규모'] || '',
      fctryGubun: r['공장구분'] || '',
      seollip: r['설립구분'] || '',
      ipju: r['입주형태'] || '',
      boyu: r['보유구분'] || '',
      registGubun: r['등록구분'] || '',
      registDe: r['등록일'] || '',
      firstRegistDe: r['최초등록일'] || '',
      firstApprDe: r['최초승인일'] || '',
      mgmtOrg: r['관리기관'] || '',
      knowledgeCenter: r['지식산업센터명'] || '',
      useArea: r['용도지역'] || '',
      jimok: r['지목'] || '',
      empM: num(r['남자종업원']), empF: num(r['여자종업원']),
      empFM: num(r['외국인남자종업원']), empFF: num(r['외국인여자종업원']),
      landArea: num(r['용지면적']), mfgArea: num(r['제조시설면적']),
      auxArea: num(r['부대시설면적']), bldArea: num(r['건축면적']),
      pilji: num(r['필지수']),
    }));
    res.json({
      ok: true,
      totalCount: Number(data.totalCount || 0),
      matchCount: Number(data.matchCount || items.length),
      pageNo: Number(data.page || pageNo),
      perPage: Number(data.perPage || perPage),
      items,
    });
  } catch (e) {
    res.status(502).json({ ok: false, reason: 'fetch_error', message: String(e.message || e) });
  }
});

// ---- 사업성 검토(팩트 시트) 집계: 전국등록공장 데이터로 공급/규모/지역/입지 분포를 matchCount로 집계 ----
const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충청북', '충청남', '전라북', '전라남', '경상북', '경상남', '제주'];
const REGION_LABEL = { 서울: '서울', 부산: '부산', 대구: '대구', 인천: '인천', 광주: '광주', 대전: '대전', 울산: '울산', 세종: '세종', 경기: '경기', 강원: '강원', 충청북: '충북', 충청남: '충남', 전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남', 제주: '제주' };
const SCALES = ['소기업', '중기업', '대기업'];
const SEOLLIP = ['일반', '일반산업단지', '국가산업단지', '지식산업센터', '창업'];
const EMP_BUCKETS = [
  { label: '무고용·미기재', min: 0, max: 0 },
  { label: '1~9명', min: 1, max: 9 },
  { label: '10~49명', min: 10, max: 49 },
  { label: '50명 이상', min: 50, max: null },
];
const feasibilityCache = new Map(); // code -> { ts, data }
const FEAS_TTL = 24 * 3600 * 1000;

async function odCount(conds) {
  const qs = new URLSearchParams({ serviceKey: FACTORY_KEY, page: '1', perPage: '1' });
  for (const [k, v] of conds) qs.append(k, v);
  const r = await fetch(`${COMPANY_BASE}?${qs}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (j && j.code && j.code < 0) throw new Error(j.msg || 'api_error');
  return Number(j.matchCount || 0);
}
// 동시 실행 상한
async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let i = 0;
  async function worker() { while (i < tasks.length) { const idx = i++; results[idx] = await tasks[idx](); } }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

app.get('/api/feasibility', async (req, res) => {
  if (!FACTORY_KEY) return res.status(503).json({ ok: false, reason: 'no_key' });
  const code = String(req.query.code || '').trim();
  if (!codepage.hasCode(code)) return res.status(400).json({ ok: false, reason: 'bad_code', message: '유효한 산업분류코드가 아닙니다.' });

  const cached = feasibilityCache.get(code);
  if (cached && Date.now() - cached.ts < FEAS_TTL) return res.json(cached.data);

  const oldCodes = codepage.to10th(code); // 10차 대표업종 코드(들)
  // 특정 조건에 대해 oldCodes 전체 합산
  const sumOld = (extra) => oldCodes.map((oc) => () => odCount([['cond[대표업종::EQ]', oc], ...extra]));

  try {
    // 태스크 구성
    const jobs = [];
    const add = (fns) => { const start = jobs.length; jobs.push(...fns); return [start, jobs.length]; };
    const totalR = add(sumOld([]));
    const scaleR = SCALES.map((v) => add(sumOld([['cond[공장규모::EQ]', v]])));
    const empR = EMP_BUCKETS.map((b) => add(sumOld(b.max == null ? [['cond[종업원합계::GTE]', String(b.min)]] : [['cond[종업원합계::GTE]', String(b.min)], ['cond[종업원합계::LTE]', String(b.max)]])));
    const regionR = REGIONS.map((rg) => add(sumOld([['cond[시도명::LIKE]', rg]])));
    const seollipR = SEOLLIP.map((v) => add(sumOld([['cond[설립구분::EQ]', v]])));
    // 형제 코드(같은 세분류) — 최대 10개
    const sibs = codepage.siblings(code).slice(0, 12);
    const sibR = sibs.map((s) => add(codepage.to10th(s.code).map((oc) => () => odCount([['cond[대표업종::EQ]', oc]]))));

    const out = await runLimited(jobs, 6);
    const sum = ([a, b]) => out.slice(a, b).reduce((x, y) => x + (y || 0), 0);

    const total = sum(totalR);
    const scale = SCALES.map((v, i) => ({ label: v, count: sum(scaleR[i]) }));
    const employee = EMP_BUCKETS.map((b, i) => ({ label: b.label, count: sum(empR[i]) }));
    const region = REGIONS.map((rg, i) => ({ label: REGION_LABEL[rg], count: sum(regionR[i]) })).sort((a, b) => b.count - a.count);
    let seollip = SEOLLIP.map((v, i) => ({ label: v, count: sum(seollipR[i]) }));
    const seollipSum = seollip.reduce((x, y) => x + y.count, 0);
    if (total - seollipSum > 0) seollip.push({ label: '기타', count: total - seollipSum });
    seollip = seollip.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
    const siblings = sibs.map((s, i) => ({ code: s.code, name: s.name, count: sum(sibR[i]), current: s.code === code })).sort((a, b) => b.count - a.count);

    const data = { ok: true, code, oldCodes, total, scale, employee, region, seollip, siblings };
    feasibilityCache.set(code, { ts: Date.now(), data });
    res.json(data);
  } catch (e) {
    const reason = /등록되지 않은/.test(String(e.message)) ? 'dataset_not_activated' : 'fetch_error';
    res.status(502).json({ ok: false, reason, message: String(e.message || e) });
  }
});

// 인증키 설정 여부만 클라이언트에 알림(키 값은 노출하지 않음)
app.get('/api/factory/status', (req, res) => {
  res.json({ enabled: !!FACTORY_KEY });
});

// robots.txt — 검색엔진·AI 크롤러 모두 허용, sitemap 안내
app.get('/robots.txt', (req, res) => {
  const base = siteUrl(req);
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      // API 엔드포인트는 크롤 대상이 아님(수집 실패로 잡히는 것 방지, 크롤 예산 절약)
      'Disallow: /api/',
      '',
      '# AI 답변 엔진 크롤러 명시적 허용',
      'User-agent: GPTBot',
      'Allow: /',
      'User-agent: OAI-SearchBot',
      'Allow: /',
      'User-agent: ChatGPT-User',
      'Allow: /',
      'User-agent: ClaudeBot',
      'Allow: /',
      'User-agent: Claude-Web',
      'Allow: /',
      'User-agent: PerplexityBot',
      'Allow: /',
      'User-agent: Google-Extended',
      'Allow: /',
      'User-agent: Yeti', // 네이버
      'Allow: /',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

// sitemap.xml — 홈 + 전체 산업분류코드 페이지
app.get('/sitemap.xml', (req, res) => {
  const base = siteUrl(req);
  const today = new Date().toISOString().slice(0, 10);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <url><loc>${base}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n`;
  for (const p of ['about', 'privacy', 'terms']) {
    xml += `  <url><loc>${base}/${p}</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>\n`;
  }
  for (const code of codepage.CODES_ALL()) {
    xml += `  <url><loc>${base}/code/${code}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  }
  // 직업분류(KSCO)
  xml += `  <url><loc>${base}/job</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
  for (const code of jobpage.CODES_ALL()) {
    xml += `  <url><loc>${base}/job/${code}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  }
  // 고용직업분류(KECO)
  xml += `  <url><loc>${base}/keco</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
  for (const code of kecopage.CODES_ALL()) {
    xml += `  <url><loc>${base}/keco/${code}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  }
  xml += `</urlset>\n`;
  res.type('application/xml').send(xml);
});

// 사이트 소개·개인정보처리방침·이용약관 (광고 심사 필수 페이지)
const sitepages = require('./sitepages');
app.get('/about', (req, res) => res.type('html').send(sitepages.renderAbout(siteUrl(req))));
app.get('/privacy', (req, res) => res.type('html').send(sitepages.renderPrivacy(siteUrl(req))));
app.get('/terms', (req, res) => res.type('html').send(sitepages.renderTerms(siteUrl(req))));

// 직업분류(KSCO) 인덱스·코드별 SSR 페이지
app.get('/job', (req, res) => {
  res.type('html').send(jobpage.renderJobIndex(siteUrl(req)));
});
app.get('/job/:code', (req, res) => {
  const code = String(req.params.code || '').trim();
  const html = jobpage.renderJobPage(code, siteUrl(req));
  if (!html) return res.status(404).type('html').send('<meta charset="utf-8"><p>존재하지 않는 직업분류코드입니다. <a href="/job">직업분류 목록</a></p>');
  res.type('html').send(html);
});

// 고용직업분류(KECO) 인덱스·코드별 SSR 페이지
app.get('/keco', (req, res) => {
  res.type('html').send(kecopage.renderKecoIndex(siteUrl(req)));
});
app.get('/keco/:code', (req, res) => {
  const html = kecopage.renderKecoPage(String(req.params.code || '').trim(), siteUrl(req));
  if (!html) return res.status(404).type('html').send('<meta charset="utf-8"><p>존재하지 않는 고용직업분류 코드입니다. <a href="/keco">목록</a></p>');
  res.type('html').send(html);
});

// 산업분류코드별 SSR 페이지
app.get('/code/:code', (req, res) => {
  const code = String(req.params.code || '').trim();
  const html = codepage.renderCodePage(code, siteUrl(req));
  if (!html) return res.status(404).type('html').send('<meta charset="utf-8"><p>존재하지 않는 산업분류코드입니다. <a href="/">홈으로</a></p>');
  res.type('html').send(html);
});

// llms.txt — AI/LLM이 사이트 구조·데이터·인용법을 이해하도록 돕는 요약(신흥 표준)
app.get('/llms.txt', (req, res) => {
  const base = siteUrl(req);
  res.type('text/plain').send(
`# 산업분류코드·직업분류코드 조회

> 한국의 공식 분류체계(산업·직업)를 코드별로 조회하는 무료 웹 서비스. 통계청·국세청·고용노동부·한국산업단지공단의 공개 데이터를 코드 단위로 통합해 제공한다. 모든 수치는 원자료에서 직접 유래하며 추정값을 사용하지 않는다.

## 제공 분류체계
- 한국표준산업분류(KSIC) 11차 — 2,038개 분류(세세분류 1,205개). 경로: ${base}/code/{5자리코드}
- 한국표준직업분류(KSCO) 8차 — 1,999개 분류. 경로: ${base}/job/{코드}
- 한국고용직업분류(KECO) 2025 — 677개 분류. 경로: ${base}/keco/{코드}

## 각 산업분류코드 페이지에서 확인 가능한 정보
- 분류명·영문명·계층 경로(대분류>중분류>소분류>세분류>세세분류)
- 공식 해설: 정의, 포함(예시) 활동, 제외 활동과 해당 코드
- 10차↔11차 신구연계 코드(개정 전후 대응)
- 국세청 업종코드 연계 및 단순경비율(일반/초과)·기준경비율 (2025년 귀속)
- 사업종류별 산재보험료율 (2026년도 고시, 근사값)
- 중소기업기본법상 중소기업·소기업 평균매출액 규모 기준
- 색인어(해당 코드로 분류되는 구체적 물품·활동명)
- 관련 분류: 같은 세분류 내 형제 코드, 이 코드를 제외 항목으로 지목하는 분류

## 부가 기능
- 물품명·업종명 검색: 색인어 30,079건 기반(정확한 업종명을 몰라도 물건 이름으로 조회)
- 전국 등록공장 검색: 회사명(실시간) / 생산품·원자재·지역(2024년 말 기준 자료)
- 사업성 검토: 업종별 전국 공장 수, 지역·규모·고용 분포 (공급 측 통계이며 매출·수요 데이터는 제공하지 않음)

## 인용 시 유의사항
- "공장 수"는 등록공장(주업종 기준) 수로 공급·경쟁 밀도의 대리지표이며 시장 수요·매출이 아니다.
- 경비율은 종합소득세 추계신고용 세무상 비율이며 실제 마진율이 아니다. (100-경비율)을 마진으로 계산하지 말 것.
- 산재보험료율은 근로복지공단 사업종류 기준 근사값이며, 정확한 요율은 사업종류 예시표를 따른다.
- 중소기업 규모 기준은 '평균매출액등' 기준으로 지원·규제 판정용이며 업종 평균매출이 아니다.
- 공장 데이터는 대표업종(주업종) 기준이므로 부업종으로 해당 품목을 생산하는 업체는 포함되지 않는다.

## 데이터 출처
- 통계청 통계분류포털(kssc.kostat.go.kr): KSIC 11차, KSCO 8차, KECO 2025, 분류 해설, 색인어, 신구연계
- 국세청: 업종코드-표준산업분류 연계표, 기준·단순경비율(2025년 귀속)
- 고용노동부: 사업종류별 산재보험료율(2026년도 고시)
- 중소기업기본법 시행령 별표1(2025.10.1)·별표3(2025.9.1)
- 한국산업단지공단: 전국등록공장현황, 공장등록생산정보

## 갱신 주기
- 통계청 분류 자료: 반기(1월·7월) 자동 재수집
- 공장 데이터셋: 연 1회 갱신 시 자동 감지

사이트: ${base}/
사이트맵: ${base}/sitemap.xml
`
  );
});

// 정식 URL(canonical/OG)을 주입해 index.html 제공 — 크롤러가 정적 메타를 읽도록
function serveIndex(req, res) {
  res.type('html').send(
    INDEX_HTML
      .replace(/%%SITE_URL%%/g, siteUrl(req))
      .replace('%%SECTIONS%%', codepage.sectionsNavHtml())
      .replace('%%SIDENAV%%', codepage.sideNavHtml())
      .replace('%%AD_SIDE%%', codepage.adSideHtml())
      .replace('%%AD_SLOT%%', codepage.adSlotHtml())
  );
}
app.get('/', serveIndex);
app.get('/index.html', serveIndex);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.listen(PORT, () => {
  console.log(`ksic-search listening on :${PORT} (factory API: ${FACTORY_KEY ? 'on' : 'off'}, site: ${SITE_URL || 'auto'})`);
});
