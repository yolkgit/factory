const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
  // 한 공장이 복수 업종코드를 가질 수 있어 LIKE 부분일치 사용
  if (indutyCode) qs.append('cond[업종코드::LIKE]', indutyCode);
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
      indutyNm: r['업종명'] || r['대표업종'] || '',
      indutyCodes: r['업종코드'] || '',
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

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.listen(PORT, () => {
  console.log(`ksic-search listening on :${PORT} (factory API: ${FACTORY_KEY ? 'on' : 'off'})`);
});
