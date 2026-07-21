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

// 한국산업단지공단 공장등록생산정보조회서비스 (data.go.kr 오픈API)
// FACTORY_API_KEY: data.go.kr에서 발급받은 '일반 인증키(Decoding)'를 환경변수로 주입
const FACTORY_KEY = process.env.FACTORY_API_KEY || '';
const FACTORY_BASE = 'https://apis.data.go.kr/B550624/fctryRegistInfo';
// 전국등록공장현황 파일데이터(업종코드 포함) odcloud API — 업종코드로 기업 조회에 사용
// data.go.kr 데이터셋 15105482 활용신청 시 같은 인증키로 동작
const COMPANY_BASE = 'https://api.odcloud.kr/api/15105482/v1/uddi:67329811-dbc4-4c82-b3b1-9e6f25721e6e';

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
      adres: it.adres || '',
      fctryManageNo: it.fctryManageNo || '',
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
  const { indutyCode = '', cmpnyNm = '', sido = '', pageNo = '1', perPage = '20' } = req.query;
  if (!indutyCode && !cmpnyNm) {
    return res.status(400).json({ ok: false, reason: 'no_query', message: '업종코드 또는 회사명을 입력하세요.' });
  }
  const qs = new URLSearchParams({ serviceKey: FACTORY_KEY, page: String(pageNo), perPage: String(perPage) });
  // 이 데이터셋은 10차 산업분류 '대표업종' 코드로 필터. 클라이언트가 11차→10차 변환해 전달.
  // (업종코드 필드는 복수 코드가 천단위 콤마로 합쳐져 있어 LIKE 매칭이 불가능하므로 대표업종::EQ 사용)
  if (indutyCode) qs.append('cond[대표업종::EQ]', indutyCode);
  if (cmpnyNm) qs.append('cond[회사명::LIKE]', cmpnyNm);
  if (sido) qs.append('cond[시도명::LIKE]', sido);
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
    const items = (data.data || []).map((r) => ({
      cmpnyNm: r['회사명'] || '',
      rprsntvNm: '',
      indutyNm: r['업종명'] || '',
      // 업종코드 필드는 복수코드가 콤마로 합쳐져 있어 신뢰불가 → 대표업종(단일 10차 코드) 사용
      indutyCodes: r['대표업종'] != null ? String(r['대표업종']) : '',
      mainProductCn: r['생산품'] || '',
      irsttNm: r['단지명'] || '',
      adres: r['공장주소'] || r['공장주소_지번'] || '',
      sido: r['시도명'] || '',
      sigungu: r['시군구명'] || '',
      emp: r['종업원합계'] || '',
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

// sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const base = siteUrl(req);
  const today = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${base}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
      `</urlset>\n`
  );
});

// llms.txt — AI/LLM이 사이트를 이해하도록 돕는 요약(신흥 표준)
app.get('/llms.txt', (req, res) => {
  const base = siteUrl(req);
  res.type('text/plain').send(
    `# 산업분류코드 조회 (KSIC 11차)\n\n` +
      `> 물품·업종명으로 한국표준산업분류(KSIC 11차) 코드를 조회하고, 분류 해설·10차 신구연계·국세청 업종코드/경비율·산재보험료율·중소기업 기준·산업분류코드별 전국 기업(공장)까지 확인하는 무료 웹 서비스.\n\n` +
      `## 주요 기능\n` +
      `- 산업분류코드(업종코드) 검색: 물품명·업종명·코드로 KSIC 11차 세세분류 조회\n` +
      `- 분류 해설: 각 코드의 정의·포함(예시)·제외 항목\n` +
      `- 10차↔11차 신구연계 코드 변환\n` +
      `- 국세청 업종코드 연계 및 기준·단순경비율(2025 귀속)\n` +
      `- 사업종류별 산재보험료율(2026)\n` +
      `- 중소기업기본법 시행령 업종별 중소기업/소기업 규모 기준\n` +
      `- 산업분류코드로 전국 등록기업(공장) 검색\n\n` +
      `## 데이터 출처\n` +
      `- 통계청 통계분류포털(KSIC 11차)\n` +
      `- 국세청(업종코드·경비율)\n` +
      `- 고용노동부(산재보험료율), 한국산업단지공단(전국등록공장현황)\n\n` +
      `사이트: ${base}/\n`
  );
});

// 정식 URL(canonical/OG)을 주입해 index.html 제공 — 크롤러가 정적 메타를 읽도록
function serveIndex(req, res) {
  res.type('html').send(INDEX_HTML.replace(/%%SITE_URL%%/g, siteUrl(req)));
}
app.get('/', serveIndex);
app.get('/index.html', serveIndex);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.listen(PORT, () => {
  console.log(`ksic-search listening on :${PORT} (factory API: ${FACTORY_KEY ? 'on' : 'off'}, site: ${SITE_URL || 'auto'})`);
});
