const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 한국산업단지공단 공장등록생산정보조회서비스 (data.go.kr 오픈API)
// FACTORY_API_KEY: data.go.kr에서 발급받은 '일반 인증키(Decoding)'를 환경변수로 주입
const FACTORY_KEY = process.env.FACTORY_API_KEY || '';
const FACTORY_BASE = 'https://apis.data.go.kr/B550624/fctryRegistInfo';

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

// 인증키 설정 여부만 클라이언트에 알림(키 값은 노출하지 않음)
app.get('/api/factory/status', (req, res) => {
  res.json({ enabled: !!FACTORY_KEY });
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.listen(PORT, () => {
  console.log(`ksic-search listening on :${PORT} (factory API: ${FACTORY_KEY ? 'on' : 'off'})`);
});
