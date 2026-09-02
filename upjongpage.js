// 국세청 업종코드(6자리) 전용 페이지.
// "업종코드" 검색자는 대부분 세금(경비율) 목적이므로, 산업분류코드 페이지와 분리해
// 업종코드 자체를 주제로 하는 페이지를 제공한다.
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const load = (f, fb) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch (e) { return fb; } };

const UPJONG = load('upjong-map.json', []);      // [{u, un, k}]
const GYEONGBI = load('gyeongbi-map.json', {});  // { u: [단순일반, 단순초과, 기준일반] }

// 업종코드 → 정보
const BY_CODE = new Map();
for (const r of UPJONG) {
  if (!BY_CODE.has(r.u)) BY_CODE.set(r.u, { u: r.u, un: r.un, ksic: [] });
  if (r.k && !BY_CODE.get(r.u).ksic.includes(r.k)) BY_CODE.get(r.u).ksic.push(r.k);
}
// 앞 2자리 그룹(업태 성격) → 코드 목록
const GROUPS = new Map();
for (const info of BY_CODE.values()) {
  const g = info.u.slice(0, 2);
  if (!GROUPS.has(g)) GROUPS.set(g, []);
  GROUPS.get(g).push(info.u);
}
for (const arr of GROUPS.values()) arr.sort();

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (v) => (v || v === 0 ? (Number.isInteger(v) ? v : Number(v).toFixed(1)) + '%' : '-');

// KSIC 정보는 codepage에서 주입 (분류명·해설 재사용)
let ksicNode = () => null;
let adSlotHtml = () => '';
let sidebarCss = '';
let headerNav = () => '';
let headerCss = '';
function setHeader(fn, css) { headerNav = fn; headerCss = css || ''; }
function setDeps(nodeFn, adFn, css) { ksicNode = nodeFn; adSlotHtml = adFn; sidebarCss = css || ''; }

const CSS = (extra) => `
${headerCss}
  body{font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1c2430;background:#f4f6fa;margin:0;line-height:1.6}
  .wrap{max-width:780px;margin:0 auto;padding:16px 16px 60px}
  .top{background:linear-gradient(135deg,#b8541f,#e07b39);color:#fff;padding:16px;border-radius:12px;display:flex;gap:14px;flex-wrap:wrap}
  .top a{color:#ffe7d6;text-decoration:none;font-size:13px}
  .bc{font-size:12.5px;color:#6b7684;margin:14px 2px}
  .bc a{color:#4a5568;text-decoration:none}
  h1{font-size:23px;margin:6px 0 2px}
  h1 .c{font-family:Consolas,monospace;color:#c2611f}
  .badge{display:inline-block;font-size:12px;background:#fdf0e7;color:#b8541f;border-radius:20px;padding:2px 10px;margin-left:6px;vertical-align:middle}
  h2{font-size:16px;margin:24px 0 8px;border-top:1px solid #e2e7ef;padding-top:16px}
  .lead{font-size:14.5px;line-height:1.8;color:#2b3648;background:#fff8f3;border:1px solid #f2dcc9;border-radius:10px;padding:13px 15px;margin:12px 0 4px}
  table.kv{width:100%;border-collapse:collapse;font-size:14px;background:#fff;border:1px solid #e2e7ef;border-radius:10px;overflow:hidden;margin:12px 0}
  table.kv th{text-align:left;background:#f8fafc;color:#4a5568;padding:9px 12px;width:38%;font-weight:600;border-top:1px solid #eef1f6}
  table.kv td{padding:9px 12px;border-top:1px solid #eef1f6}
  .big{font-size:15px;color:#4a5568;margin:6px 0}
  .big .n{font-size:30px;font-weight:800;color:#c2611f}
  .note{font-size:11.5px;color:#9aa3b0;line-height:1.65;margin-top:8px}
  .warn{background:#fff4f4;border-left:4px solid #e05252;padding:12px 14px;border-radius:8px;font-size:13px;color:#4a5568;line-height:1.7;margin:10px 0}
  .linklist{list-style:none;padding:0;margin:0;columns:2;font-size:14px}
  .linklist li{margin:3px 0;break-inside:avoid}
  .linklist a,.qa a{color:#c2611f;text-decoration:none}
  .linklist a:hover{text-decoration:underline}
  .qa-item{border-bottom:1px solid #eef1f6;padding:9px 0}
  .qa-q{font-size:14px;margin:0 0 4px;color:#1c2430}
  .qa-q::before{content:'Q. ';color:#c2611f;font-weight:700}
  .qa-a{font-size:13.5px;margin:0;color:#4a5568;line-height:1.7}
  .qa-a::before{content:'A. ';color:#8a94a3;font-weight:700}
  .rellinks{display:flex;flex-wrap:wrap;gap:7px}
  .rellinks a{font-size:13px;color:#3d4a5c;text-decoration:none;background:#fdf0e7;border:1px solid #f2dcc9;border-radius:8px;padding:5px 11px}
  .ad-slot{margin-top:26px;padding:12px;border:1px solid #eef1f6;border-radius:12px;background:#fbfcfe;text-align:center}
  .ad-label{font-size:11px;color:#b3bac6;margin-bottom:8px}
  .ad-disc{font-size:11px;color:#9aa3b0;margin-top:8px}
  footer{margin-top:30px;font-size:11.5px;color:#9aa3b0;text-align:center}
  footer a{color:#9aa3b0}
${extra}
`;

function renderUpjongPage(code, siteUrl) {
  const info = BY_CODE.get(code);
  if (!info) return null;
  const g = GYEONGBI[code];
  const url = `${siteUrl}/upjong/${code}`;
  const ksicList = info.ksic.map((k) => ({ code: k, node: ksicNode(k) })).filter((x) => x.node);

  const title = `업종코드 ${code} ${info.un} | 단순경비율·기준경비율`;
  const metaDesc = g
    ? `국세청 업종코드 ${code}(${info.un})의 2025년 귀속 단순경비율은 ${g[0]}%, 기준경비율은 ${g[2]}%입니다. 연계 산업분류코드와 종합소득세 신고 참고 정보.`
    : `국세청 업종코드 ${code}(${info.un}) 정보와 연계 산업분류코드(KSIC)를 확인하세요.`;

  const bcLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '업종코드 조회', item: `${siteUrl}/upjong` },
      { '@type': 'ListItem', position: 2, name: `${code} ${info.un}`, item: url },
    ],
  };

  // 실제 검색 질문에 답하는 Q&A
  const qa = [];
  qa.push({ q: `업종코드 ${code}은 무엇인가요?`, a: `업종코드 ${code}은 국세청이 정한 ${info.un}의 업종코드입니다. 사업자등록과 종합소득세·부가세 신고에 사용합니다.` });
  if (g) {
    qa.push({
      q: `${info.un}(${code})의 단순경비율은?`,
      a: `2025년 귀속 기준 단순경비율은 ${g[0]}%입니다.${g[1] ? ` 수입금액 초과분에는 초과율 ${g[1]}%가 적용됩니다.` : ''} 단순경비율은 수입금액이 일정 기준 미만인 소규모 사업자가 추계신고할 때 사용합니다.`,
    });
    qa.push({
      q: `${info.un}(${code})의 기준경비율은?`,
      a: `2025년 귀속 기준 기준경비율은 ${g[2]}%입니다. 기준경비율은 매입비·임차료·인건비 등 주요경비를 증빙으로 공제한 뒤 나머지를 비율로 인정하는 방식이라, 단순경비율과 직접 비교할 수 없습니다.`,
    });
  }
  if (ksicList.length) {
    qa.push({
      q: `업종코드 ${code}의 산업분류코드는?`,
      a: `업종코드 ${code}에 연계되는 한국표준산업분류(KSIC 11차) 코드는 ${ksicList.map((x) => `${x.code}(${x.node.name})`).join(', ')}입니다. 산업분류코드는 정책자금·지원사업·인허가에, 업종코드는 세금 신고에 사용합니다.`,
    });
  }
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) };

  let body = `<p class="lead"><b>${esc(info.un)}</b>의 국세청 <b>업종코드는 ${esc(code)}</b>입니다.
    ${g ? `2025년 귀속 <b>단순경비율 ${pct(g[0])}</b>, <b>기준경비율 ${pct(g[2])}</b>가 적용됩니다.` : ''}
    ${ksicList.length ? ` 연계 산업분류코드(KSIC 11차)는 ${ksicList.map((x) => esc(x.code)).join(', ')}입니다.` : ''}</p>`;

  if (g) {
    body += `<h2>경비율 (2025년 귀속)</h2>
      <div class="big"><span class="n">${pct(g[0])}</span> 단순경비율${g[1] ? ` <span style="font-size:13px;color:#8a94a3">(초과율 ${pct(g[1])})</span>` : ''}</div>
      <div class="big"><span class="n">${pct(g[2])}</span> 기준경비율</div>
      <div class="warn"><b>두 비율은 계산 방식이 다릅니다.</b><br>
        · <b>단순경비율</b> — 수입금액이 기준 미만인 소규모 사업자용. 수입 × (1−경비율)로 소득 계산, 증빙 불필요<br>
        · <b>기준경비율</b> — 그 이상 사업자용. 매입·임차료·인건비를 증빙으로 공제한 뒤 나머지를 비율로 인정<br>
        숫자가 크게 차이나는 건 방식이 달라서이며, 서로 빼거나 비교하는 값이 아닙니다.</div>
      <div class="warn" style="border-left-color:#e0a052;background:#fffaf2"><b>경비율은 마진율이 아닙니다.</b><br>
        세금 계산용으로 국가가 정한 추계 비율이며 실제 원가·이익률과 다릅니다. “경비율 90% → 마진 10%” 같은 계산은 맞지 않습니다.</div>`;
  }

  body += `<h2>기본 정보</h2><table class="kv"><tbody>
    <tr><th>국세청 업종코드</th><td>${esc(code)}</td></tr>
    <tr><th>업종명</th><td>${esc(info.un)}</td></tr>
    ${g ? `<tr><th>단순경비율(일반)</th><td>${pct(g[0])}</td></tr>` : ''}
    ${g && g[1] ? `<tr><th>단순경비율(초과)</th><td>${pct(g[1])}</td></tr>` : ''}
    ${g ? `<tr><th>기준경비율</th><td>${pct(g[2])}</td></tr>` : ''}
    ${ksicList.length ? `<tr><th>연계 산업분류코드</th><td>${ksicList.map((x) => `<a href="/code/${x.code}">${esc(x.code)} ${esc(x.node.name)}</a>`).join('<br>')}</td></tr>` : ''}
    </tbody></table>`;

  if (ksicList.length) {
    body += `<h2>산업분류코드와 무엇이 다른가요?</h2>
      <p style="font-size:14px;color:#3d4a5c;line-height:1.8">
      <b>업종코드(6자리)</b>는 국세청이 <b>세금 계산</b>을 위해 정한 코드로 사업자등록·종합소득세 신고에 씁니다.<br>
      <b>산업분류코드(5자리)</b>는 통계청이 정한 코드로 정책자금·지원사업·인허가·통계에 씁니다.<br>
      둘은 1:1로 대응되지 않으며, 같은 산업분류코드에 여러 업종코드가 연결되기도 합니다.</p>`;
  }

  // 같은 그룹(앞 2자리)의 다른 업종코드
  const sibs = (GROUPS.get(code.slice(0, 2)) || []).filter((c) => c !== code).slice(0, 20);
  if (sibs.length) {
    body += `<h2>비슷한 업종코드</h2><ul class="linklist">` +
      sibs.map((c) => `<li><a href="/upjong/${c}">${esc(c)} ${esc(BY_CODE.get(c).un)}</a></li>`).join('') + `</ul>`;
  }

  body += `<h2>자주 묻는 질문</h2><div class="qa">` +
    qa.map((x) => `<div class="qa-item"><h3 class="qa-q">${esc(x.q)}</h3><p class="qa-a">${esc(x.a)}</p></div>`).join('') + `</div>`;

  body += `<h2>이런 것도 함께 찾아보세요</h2><div class="rellinks">
    <a href="/upjong">국세청 업종코드 전체 조회</a>
    <a href="/">산업분류코드 검색</a>
    ${ksicList.length ? `<a href="/code/${ksicList[0].code}">${esc(ksicList[0].node.name)} 산업분류 상세</a>` : ''}
    <a href="/job">직업분류코드(KSCO)</a></div>`;

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}" />
<link rel="canonical" href="${url}" /><link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow, max-snippet:-1" />
<meta property="og:type" content="article" /><meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(metaDesc)}" /><meta property="og:url" content="${url}" />
<meta property="og:site_name" content="산업분류코드 조회" /><meta property="og:locale" content="ko_KR" />
<script type="application/ld+json">${JSON.stringify(bcLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<style>${CSS(sidebarCss)}</style>
</head><body>
${headerNav("upjong")}
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회</a><a href="/upjong">업종코드 전체</a></div>
  <nav class="bc"><a href="/upjong">국세청 업종코드</a> › <span>${esc(code)} ${esc(info.un)}</span></nav>
  <h1><span class="c">${esc(code)}</span> ${esc(info.un)}<span class="badge">국세청 업종코드</span></h1>
  ${body}
  ${adSlotHtml()}
  <footer>출처: 국세청 업종코드-표준산업분류 연계표 · 기준·단순경비율(2025년 귀속) · 참고용<br>
    <a href="/about">사이트 소개</a> · <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a></footer>
</div>
</body></html>`;
}

function renderUpjongIndex(siteUrl) {
  const total = BY_CODE.size;
  const withRate = [...BY_CODE.keys()].filter((c) => GYEONGBI[c]).length;
  const groups = [...GROUPS.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: '국세청 업종코드란?', acceptedAnswer: { '@type': 'Answer', text: '국세청 업종코드는 사업자등록과 세금 신고에 사용하는 6자리 코드입니다. 업종코드에 따라 단순경비율·기준경비율이 달라져 세금 계산에 직접 영향을 줍니다.' } },
      { '@type': 'Question', name: '업종코드와 산업분류코드는 어떻게 다른가요?', acceptedAnswer: { '@type': 'Answer', text: '업종코드는 국세청이 정한 6자리 코드로 세금 신고에, 산업분류코드(KSIC)는 통계청이 정한 5자리 코드로 정책자금·지원사업·인허가에 사용합니다. 두 코드는 1:1로 대응되지 않습니다.' } },
      { '@type': 'Question', name: '내 업종코드를 어떻게 찾나요?', acceptedAnswer: { '@type': 'Answer', text: '만드는 물품이나 하는 일을 검색하면 연계된 국세청 업종코드와 경비율을 함께 확인할 수 있습니다. 사업자등록증에 6자리 코드가 적혀 있다면 그것이 업종코드입니다.' } },
    ],
  };
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>국세청 업종코드 조회 | 업종별 단순경비율·기준경비율</title>
<meta name="description" content="국세청 업종코드 ${total.toLocaleString()}개를 조회하세요. 업종코드별 단순경비율·기준경비율(2025년 귀속)과 연계 산업분류코드(KSIC)를 함께 확인할 수 있습니다. 종합소득세 신고 참고용." />
<link rel="canonical" href="${siteUrl}/upjong" /><link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" /><meta property="og:title" content="국세청 업종코드 조회 | 경비율 확인" />
<meta property="og:description" content="업종코드별 단순경비율·기준경비율과 연계 산업분류코드를 한 번에 확인하세요." />
<meta property="og:url" content="${siteUrl}/upjong" />
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<style>${CSS(sidebarCss)}
  .search{display:flex;gap:8px;margin:16px 0}
  .search input{flex:1;border:1px solid #e2e7ef;border-radius:10px;padding:12px 14px;font-size:15px;outline:0}
  .search input:focus{border-color:#e07b39}
  .search button{border:0;background:#e07b39;color:#fff;font-weight:700;border-radius:10px;padding:0 20px;cursor:pointer;font-size:14px}
  .grp{background:#fff;border:1px solid #e2e7ef;border-radius:12px;padding:13px 15px;margin-top:12px}
  .grp b{color:#c2611f;font-size:14.5px}
  .grp .items{margin-top:6px;font-size:13.5px;line-height:1.9}
  .grp .items a{color:#4a5568;text-decoration:none;margin-right:10px}
  .grp .items a:hover{color:#c2611f;text-decoration:underline}
  #res{margin-top:10px}
  .rcard{background:#fff;border:1px solid #e2e7ef;border-radius:10px;padding:11px 14px;margin-bottom:7px}
  .rcard a{color:#c2611f;font-weight:700;text-decoration:none;font-family:Consolas,monospace}
  .rcard .rn{color:#1c2430;margin-left:6px}
  .rcard .rg{font-size:12.5px;color:#2b7a3d;margin-top:3px}
</style>
</head><body>
${headerNav("upjong")}
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회</a><a href="/job">직업분류코드</a></div>
  <h1>국세청 업종코드 조회</h1>
  <p class="lead"><b>국세청 업종코드</b>는 사업자등록과 세금 신고에 쓰는 <b>6자리 코드</b>입니다.
    업종코드에 따라 <b>단순경비율·기준경비율</b>이 달라져 종합소득세 계산에 직접 영향을 줍니다.<br>
    현재 <b>${total.toLocaleString()}개</b> 업종코드와 <b>${withRate.toLocaleString()}개</b>의 경비율 정보를 제공합니다.</p>

  <div class="search">
    <input id="q" type="search" placeholder="업종명 또는 업종코드 입력 (예: 빵, 154104, 음식점)" autocomplete="off" />
    <button onclick="doSearch()">검색</button>
  </div>
  <div id="res"></div>

  <h2>업종코드와 산업분류코드 차이</h2>
  <table class="kv"><tbody>
    <tr><th>구분</th><td><b>업종코드</b> (이 페이지)</td></tr>
    <tr><th>기관 / 자릿수</th><td>국세청 / <b>6자리</b></td></tr>
    <tr><th>쓰는 곳</th><td>사업자등록, 종합소득세·부가세 신고, 경비율</td></tr>
    <tr><th>산업분류코드</th><td>통계청 / <b>5자리</b> — 정책자금·지원사업·인허가 (<a href="/">조회하기</a>)</td></tr>
  </tbody></table>
  <p class="note">두 코드는 1:1로 대응되지 않습니다. 국세청은 경비율이 달라지는 기준으로 더 잘게 나누기 때문에, 하나의 산업분류코드에 여러 업종코드가 연결되기도 합니다.</p>

  <h2>업태별 업종코드</h2>
  ${groups.map(([g, codes]) => {
    const shown = codes.slice(0, 10);
    return `<div class="grp"><b>${esc(g)}xxxx</b> · ${esc(BY_CODE.get(codes[0]).un)} 등 ${codes.length}개
      <div class="items">${shown.map((c) => `<a href="/upjong/${c}">${esc(c)}</a>`).join('')}${codes.length > 10 ? ` <span style="color:#b3bac6">외 ${codes.length - 10}개</span>` : ''}</div></div>`;
  }).join('')}

  ${adSlotHtml()}
  <footer>출처: 국세청 업종코드-표준산업분류 연계표 · 기준·단순경비율(2025년 귀속) · 참고용<br>
    <a href="/about">사이트 소개</a> · <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a></footer>
</div>
<script>
const DATA = ${JSON.stringify([...BY_CODE.values()].map((x) => [x.u, x.un, GYEONGBI[x.u] ? [GYEONGBI[x.u][0], GYEONGBI[x.u][2]] : null]))};
const norm = (s) => String(s).toLowerCase().replace(/[\\s,·.\\-()]/g, '');
function doSearch(){
  const q = norm(document.getElementById('q').value);
  const el = document.getElementById('res');
  if(!q){ el.innerHTML=''; return; }
  const hits = DATA.filter(function(r){ return r[0].indexOf(q)===0 || norm(r[1]).indexOf(q)>=0; }).slice(0,40);
  if(!hits.length){ el.innerHTML='<div class="rcard">검색 결과가 없습니다. 다른 단어로 시도해보세요.</div>'; return; }
  el.innerHTML = hits.map(function(r){
    return '<div class="rcard"><a href="/upjong/'+r[0]+'">'+r[0]+'</a><span class="rn">'+r[1]+'</span>'+
      (r[2] ? '<div class="rg">단순경비율 '+r[2][0]+'% · 기준경비율 '+r[2][1]+'%</div>' : '')+'</div>';
  }).join('');
}
document.getElementById('q').addEventListener('input', doSearch);
document.getElementById('q').addEventListener('keypress', function(e){ if(e.key==='Enter') doSearch(); });
</script>
</body></html>`;
}

module.exports = {
  renderUpjongPage, renderUpjongIndex, setDeps, setHeader,
  CODES_ALL: () => [...BY_CODE.keys()],
  hasCode: (c) => BY_CODE.has(c),
  count: () => BY_CODE.size,
};
