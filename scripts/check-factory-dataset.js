// 전국등록공장현황(odcloud 15105482) 데이터셋에서 "상세 필드를 갖춘 최신 파일"을 자동 탐지한다.
// 공공데이터포털이 연 1회 새 스냅샷 파일(uddi)을 추가하므로, 갱신 시 자동으로 최신본을 쓰기 위함.
// 사용: node scripts/check-factory-dataset.js  → data/factory-dataset.json 갱신(변경 시)
const fs = require('fs');
const path = require('path');

const KEY = process.env.FACTORY_API_KEY || '';
const NS = '15105482/v1';
const SWAGGER = `https://infuser.odcloud.kr/oas/docs?namespace=${NS}`;
// 상세 페이지에 필요한 핵심 필드(이게 있어야 기존 기능이 동작)
const REQUIRED = ['회사명', '생산품', '대표업종', '시도명', '공장규모', '종업원합계'];

async function listUddis() {
  const r = await fetch(SWAGGER, { signal: AbortSignal.timeout(30000) });
  const s = await r.json();
  return Object.keys(s.paths || {}).map((p) => p.split('/').pop()).filter((u) => u.startsWith('uddi:'));
}

async function probe(uddi) {
  const base = `https://api.odcloud.kr/api/${NS}/${uddi}`;
  const qs = new URLSearchParams({ serviceKey: KEY, page: '1', perPage: '1' });
  const r = await fetch(`${base}?${qs}`, { signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({}));
  if (j.code && j.code < 0) throw new Error(j.msg || 'api error');
  const row = (j.data || [])[0] || {};
  const fields = Object.keys(row);
  const hasAll = REQUIRED.every((f) => fields.includes(f));
  return { uddi, total: Number(j.totalCount || 0), fields: fields.length, detailed: hasAll };
}

async function main() {
  if (!KEY) throw new Error('FACTORY_API_KEY 미설정');
  const uddis = await listUddis();
  const results = [];
  for (const u of uddis) {
    try { results.push(await probe(u)); }
    catch (e) { console.warn(`  ${u.slice(0, 13)} 확인 실패: ${e.message}`); }
  }
  results.forEach((r) => console.log(`  ${r.uddi.slice(0, 13)} 총 ${r.total.toLocaleString()} · 필드 ${r.fields} · ${r.detailed ? '상세' : '간이'}`));

  // 상세 필드를 갖춘 것 중 건수가 가장 많은(=최신) 파일 선택
  const detailed = results.filter((r) => r.detailed);
  if (!detailed.length) {
    console.error('상세 필드를 갖춘 파일이 없습니다. 기존 설정을 유지합니다.');
    process.exit(1);
  }
  const best = detailed.sort((a, b) => b.total - a.total)[0];

  const outPath = path.join(__dirname, '..', 'data', 'factory-dataset.json');
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) { /* 최초 실행 */ }

  if (prev && prev.uddi === best.uddi && prev.total === best.total) {
    console.log(`변경 없음: ${best.uddi.slice(0, 13)} (${best.total.toLocaleString()}건)`);
    return;
  }
  fs.writeFileSync(outPath, JSON.stringify({ uddi: best.uddi, total: best.total, checkedFields: best.fields }, null, 1), 'utf8');
  console.log(`갱신됨: ${prev ? `${prev.uddi.slice(0, 13)}(${prev.total.toLocaleString()}) → ` : ''}${best.uddi.slice(0, 13)}(${best.total.toLocaleString()}건)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
