// 산업분류코드별 SSR(서버렌더링) 페이지 생성기.
// 크롤러·AI가 각 코드의 전체 내용을 읽도록 정적 HTML을 생성하고, 내부링크로 촘촘히 연결한다.
const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'ksic-data.json'), 'utf8'));

const LV_NAME = { 1: '대분류', 2: '중분류', 3: '소분류', 4: '세분류', 5: '세세분류' };

const NODES = new Map();
const CHILDREN = new Map();
const CODE_TERMS = new Map();
const DESC = DATA.desc || {};
const GYEONGBI = DATA.gyeongbi || {};
const NEW2OLD = new Map();
const OLD2NEW = new Map();
const UPJONG_BY_K = new Map();
const REFS_IN = new Map();

for (const [code, name, level, parent] of DATA.tree) NODES.set(code, { code, name, level, parent: parent || null });
for (const n of NODES.values()) {
  if (n.parent) {
    if (!CHILDREN.has(n.parent)) CHILDREN.set(n.parent, []);
    CHILDREN.get(n.parent).push(n.code);
  }
}
for (const arr of CHILDREN.values()) arr.sort();
for (const [code, term] of DATA.terms) {
  if (!CODE_TERMS.has(code)) CODE_TERMS.set(code, []);
  CODE_TERMS.get(code).push(term);
}
for (const [nw, old, oldName] of DATA.oldnew || []) {
  if (!NEW2OLD.has(nw)) NEW2OLD.set(nw, []);
  NEW2OLD.get(nw).push({ old, oldName });
  if (!OLD2NEW.has(old)) OLD2NEW.set(old, []);
  if (!OLD2NEW.get(old).includes(nw)) OLD2NEW.get(old).push(nw);
}
for (const [u, un, k] of DATA.upjong || []) {
  if (!UPJONG_BY_K.has(k)) UPJONG_BY_K.set(k, []);
  UPJONG_BY_K.get(k).push({ u, un });
}
for (const code in DESC) {
  const d = DESC[code].d;
  if (!d) continue;
  const seen = new Set();
  for (const m of d.matchAll(/\d{5}/g)) {
    const ref = m[0];
    if (ref === code || seen.has(ref) || !NODES.has(ref)) continue;
    seen.add(ref);
    if (!REFS_IN.has(ref)) REFS_IN.set(ref, []);
    REFS_IN.get(ref).push(code);
  }
}

// --- 중소기업기본법 시행령 별표1(중소기업)·별표3(소기업) 규모 기준(억원) ---
// index.html의 SME_* 상수와 동일. 법령 개정 시 양쪽 함께 갱신.
const SME_BY_DIV = { '17':1800,'24':1800,'28':1800,'14':1500,'15':1500,'32':1500,'10':1200,'20':1200,'22':1200,'25':1200,'29':1200,'30':1200,'31':1200,'12':1000,'13':1000,'16':1000,'19':1000,'26':1000,'33':1000,'36':1000,'11':800,'18':800,'21':800,'23':800,'27':800,'34':600,'76':400 };
const SME_BY_SEC = { F:1200,G:1200,A:1000,B:1000,D:1000,H:1000,J:1000,E:800,N:800,M:600,Q:600,R:600,S:600,I:400,K:400,L:400,P:400 };
const SMALL_BY_DIV = { '19':140,'24':140,'10':120,'11':120,'14':120,'15':120,'20':120,'21':120,'23':120,'25':120,'26':120,'28':120,'29':120,'30':120,'32':120,'36':120,'12':80,'13':80,'16':80,'17':80,'18':80,'22':80,'27':80,'31':80,'33':80,'34':15 };
const SMALL_BY_SEC = { D:120,H:100,K:100,A:80,B:80,F:80,G:60,J:50,E:40,L:40,M:30,N:30,R:30,I:15,P:15,Q:15,S:15 };
// 2026 사업종류별 산재보험료율(‰)
const SANJAE_MFG_BY_DIV = { '10':16,'11':16,'12':16,'13':11,'14':11,'15':11,'16':20,'17':20,'18':9,'20':13,'22':13,'19':7,'21':7,'23':13,'25':13,'29':13,'30':13,'34':13,'24':10,'26':6,'27':6,'28':6,'31':24,'32':12,'33':12 };
const SANJAE_BY_SEC = { C:13,D:7,E:7,F:35,H:8,J:9,G:8,I:8,L:7,N:8,M:6,P:6,Q:6,R:6,K:5,O:9,S:8,T:8,U:8 };

function pathOf(code) {
  const parts = [];
  let cur = NODES.get(code);
  while (cur) { parts.unshift(cur); cur = cur.parent ? NODES.get(cur.parent) : null; }
  return parts;
}
function smeInfo(code) {
  const p = pathOf(code); if (!p.length) return null;
  const sec = p[0].code, div = code.slice(0, 2);
  if (sec === 'S' && div === '94') return null;
  let sme = SME_BY_DIV[div]; if (sme === undefined) sme = SME_BY_SEC[sec];
  let small = SMALL_BY_DIV[div]; if (small === undefined) small = SMALL_BY_SEC[sec];
  if (code === '30393') sme = 1500;
  if (sme === undefined && small === undefined) return null;
  return { sme, small };
}
function sanjaeRate(code) {
  const p = pathOf(code); if (!p.length) return null;
  const sec = p[0].code, div = code.slice(0, 2);
  if (sec === 'A') return div === '02' ? { rate: 58, label: '임업' } : div === '03' ? { rate: 27, label: '어업' } : { rate: 20, label: '농업' };
  if (sec === 'B') return div === '05' ? { rate: 185, label: '석탄광업·채석업' } : { rate: 57, label: '금속·비금속·기타광업' };
  if (sec === 'C') { const r = SANJAE_MFG_BY_DIV[div]; return { rate: r !== undefined ? r : 13, label: '제조업' }; }
  const r = SANJAE_BY_SEC[sec]; return r == null ? null : { rate: r, label: null };
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const codeLink = (c) => { const n = NODES.get(c); return n ? `<a href="/code/${c}">${esc(c)} ${esc(n.name)}</a>` : esc(c); };

function descBlock(code) {
  const d = DESC[code];
  if (!d || !d.d) return '';
  const lines = d.d.split('\n').map((line) => {
    if (line === '[예시]') return '<div class="sec inc">포함(예시)</div>';
    if (line === '[제외]') return '<div class="sec exc">제외</div>';
    const html = esc(line).replace(/(\d{5})/g, (m) => (NODES.has(m) ? `<a href="/code/${m}">${m}</a>` : m));
    return `<div>${html}</div>`;
  }).join('');
  return `<div class="descbox">${lines}</div>`;
}

function CODES_ALL() { return [...NODES.keys()]; }

function renderCodePage(code, siteUrl) {
  const node = NODES.get(code);
  if (!node) return null;
  const p = pathOf(code);
  const isLeaf = node.level === 5;
  const url = `${siteUrl}/code/${code}`;
  const desc5 = DESC[code];
  const defText = desc5 && desc5.d ? desc5.d.replace(/\n\[예시\]\n/g, ' 예시: ').replace(/\n\[제외\]\n/g, ' 제외: ').replace(/\n/g, ' ').slice(0, 150) : '';

  // 메타 설명
  const metaDesc = isLeaf
    ? `${node.name}(산업분류코드 ${code}) 한국표준산업분류 KSIC 11차 정보. ${defText || '분류 해설, 색인어, 10차 연계코드, 국세청 업종코드·경비율, 관련 분류, 이 업종 전국 기업 검색.'}`
    : `${node.name}(${code}) ${LV_NAME[node.level]} 산업분류코드. 하위 분류 ${(CHILDREN.get(code) || []).length}개와 한국표준산업분류(KSIC 11차) 세부 업종코드 목록.`;

  const breadcrumbHtml = p.map((n, i) => (i === p.length - 1 ? `<span>${esc(n.code)} ${esc(n.name)}</span>` : `<a href="/code/${n.code}">${esc(n.name)}</a>`)).join(' › ');
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: '산업분류코드 조회', item: `${siteUrl}/` },
      ...p.map((n, i) => ({ '@type': 'ListItem', position: i + 2, name: `${n.code} ${n.name}`, item: `${siteUrl}/code/${n.code}` }))],
  };

  let body = '';
  if (desc5 && desc5.e) body += `<p class="eng">${esc(desc5.e)}</p>`;
  body += descBlock(code);

  // 하위 분류
  const kids = CHILDREN.get(code) || [];
  if (kids.length) {
    body += `<h2>하위 분류 (${kids.length}개)</h2><ul class="linklist">${kids.map((k) => `<li>${codeLink(k)}</li>`).join('')}</ul>`;
  }

  if (isLeaf) {
    // 10차 연계
    const olds = NEW2OLD.get(code);
    if (olds && olds.length) {
      const same = olds.length === 1 && olds[0].old === code;
      body += `<h2>10차 신구연계</h2><p>${same ? '10차(구 분류)에서도 동일한 코드입니다.' : olds.map((o) => (o.old === code ? `${esc(o.old)}(동일)` : `<b>${esc(o.old)}</b> ${esc(o.oldName)}`)).join(', ')}</p>`;
    }
    // 경비율·산재·중소기업
    const ups = UPJONG_BY_K.get(code) || [];
    const s = smeInfo(code);
    const sj = sanjaeRate(code);
    if (ups.length || s || sj) {
      body += `<h2>업종코드·경비율·요율</h2><table class="kv">`;
      if (ups.length) {
        const rows = ups.slice(0, 8).map((o) => {
          const g = GYEONGBI[o.u];
          const rate = g ? ` — 단순경비율 ${g[0]}%${g[1] ? `(초과 ${g[1]}%)` : ''}, 기준경비율 ${g[2]}%` : '';
          return `${esc(o.u)} ${esc(o.un)}${rate}`;
        }).join('<br>');
        body += `<tr><th>국세청 업종코드·경비율</th><td>${rows}</td></tr>`;
      }
      if (sj) body += `<tr><th>산재보험료율(2026)</th><td>${sj.rate}‰ (1,000분의 ${sj.rate})${sj.label ? ` · ${esc(sj.label)}` : ''}</td></tr>`;
      if (s) body += `<tr><th>중소기업 기준</th><td>평균매출액 ${s.sme !== undefined ? `중소기업 ${s.sme.toLocaleString()}억원 이하` : ''}${s.small !== undefined ? ` · 소기업 ${s.small.toLocaleString()}억원 이하` : ''}</td></tr>`;
      body += `</table>`;
    }
    // 색인어
    const terms = CODE_TERMS.get(code) || [];
    if (terms.length) body += `<h2>색인어 (${terms.length}개)</h2><p class="terms">${terms.map((t) => esc(t)).join(' · ')}</p>`;
    // 형제·관련
    const sibs = (CHILDREN.get(node.parent) || []).filter((c) => c !== code);
    if (sibs.length) body += `<h2>같은 세분류 내 다른 코드</h2><ul class="linklist">${sibs.map((c) => `<li>${codeLink(c)}</li>`).join('')}</ul>`;
    const ins = REFS_IN.get(code) || [];
    if (ins.length) body += `<h2>이 코드로 안내하는 분류</h2><ul class="linklist">${ins.map((c) => `<li>${codeLink(c)}</li>`).join('')}</ul>`;
    body += `<p class="cta"><a href="/?q=${code}">🔎 대화형 도구에서 ‘${esc(node.name)}’ 열기</a> · <a href="/?q=${code}">🏭 이 업종 전국 기업(공장) 검색</a></p>`;
  }

  const faqLd = isLeaf ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `${node.name}의 산업분류코드는?`, acceptedAnswer: { '@type': 'Answer', text: `${node.name}의 한국표준산업분류(KSIC 11차) 코드는 ${code}입니다.` } },
      ...(NEW2OLD.get(code) && NEW2OLD.get(code)[0].old !== code ? [{ '@type': 'Question', name: `${node.name}의 10차 코드는?`, acceptedAnswer: { '@type': 'Answer', text: `10차(구 분류) 기준 코드는 ${NEW2OLD.get(code).map((o) => o.old).join(', ')}입니다.` } }] : []),
    ],
  } : null;

  const title = isLeaf
    ? `${node.name} 산업분류코드 ${code} | KSIC 11차 업종코드·경비율`
    : `${node.name} (${code}) ${LV_NAME[node.level]} 산업분류코드 | KSIC 11차`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(metaDesc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="산업분류코드 조회" />
<meta property="og:locale" content="ko_KR" />
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
${faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ''}
<style>
  body{font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1c2430;background:#f4f6fa;margin:0;line-height:1.6}
  .wrap{max-width:780px;margin:0 auto;padding:16px 16px 60px}
  .top{background:linear-gradient(135deg,#1a55c4,#256ef4);color:#fff;padding:16px;border-radius:12px}
  .top a{color:#dce7ff;text-decoration:none;font-size:13px}
  .bc{font-size:12.5px;color:#6b7684;margin:14px 2px}
  .bc a{color:#4a5568;text-decoration:none}.bc a:hover{color:#256ef4}
  h1{font-size:22px;margin:6px 0 2px}
  h1 .c{font-family:Consolas,monospace;color:#256ef4}
  .lv{display:inline-block;font-size:12px;background:#eef3fe;color:#1a55c4;border-radius:20px;padding:2px 9px;margin-left:6px;vertical-align:middle}
  h2{font-size:16px;margin:24px 0 8px;border-top:1px solid #e2e7ef;padding-top:16px}
  .eng{color:#8a94a3;font-style:italic;margin:2px 0 0}
  .descbox{background:#fff;border:1px solid #eef1f6;border-radius:10px;padding:12px 14px;font-size:14px}
  .descbox .sec{font-weight:700;font-size:12px;margin:8px 0 2px}
  .descbox .sec.inc{color:#2b7a3d}.descbox .sec.exc{color:#c05621}
  .descbox a,.linklist a,.cta a{color:#256ef4;text-decoration:none}
  .descbox a:hover,.linklist a:hover{text-decoration:underline}
  .linklist{list-style:none;padding:0;margin:0;columns:2;font-size:14px}
  .linklist li{margin:3px 0;break-inside:avoid}
  .terms{font-size:13.5px;color:#4a5568}
  table.kv{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff;border:1px solid #eef1f6;border-radius:10px;overflow:hidden}
  table.kv th{text-align:left;background:#f8fafc;color:#4a5568;padding:9px 12px;width:34%;vertical-align:top;font-weight:600}
  table.kv td{padding:9px 12px;border-top:1px solid #eef1f6}
  .cta{margin-top:22px;background:#f5f9ff;border:1px solid #d6e0f5;border-radius:10px;padding:12px 14px;font-size:14px}
  footer{margin-top:30px;font-size:11.5px;color:#9aa3b0;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회 홈</a></div>
  <nav class="bc">${breadcrumbHtml}</nav>
  <h1><span class="c">${esc(code)}</span> ${esc(node.name)}<span class="lv">${LV_NAME[node.level]}</span></h1>
  ${body}
  <footer>출처: 통계청 한국표준산업분류(KSIC 11차) · 국세청·고용노동부·한국산업단지공단 자료 기반 · 참고용</footer>
</div>
</body>
</html>`;
}

// 홈페이지에 주입할 대분류(A~U) 바로가기 링크 HTML
function sectionsNavHtml() {
  const secs = [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code));
  return secs.map((n) => `<a href="/code/${n.code}">${esc(n.code)}. ${esc(n.name.replace(/\(.*\)$/, '').trim())}</a>`).join('\n');
}

// 사업성 검토용 헬퍼 (server.js에서 재사용)
function to10th(code) {
  const o = NEW2OLD.get(code);
  if (o && o.length) return [...new Set(o.map((x) => x.old))];
  return [code];
}
function siblings(code) {
  const n = NODES.get(code);
  if (!n || !n.parent) return [];
  return (CHILDREN.get(n.parent) || []).map((c) => ({ code: c, name: NODES.get(c).name }));
}
function getNode(code) { return NODES.get(code) || null; }

module.exports = { renderCodePage, CODES_ALL, sectionsNavHtml, hasCode: (c) => NODES.has(c), to10th, siblings, getNode };
