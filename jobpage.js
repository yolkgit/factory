// 한국표준직업분류(KSCO) 8차 코드별 SSR 페이지 생성기. codepage.js(KSIC)와 동일한 구조.
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const load = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch (e) { return fallback; }
};

const TREE = load('ksco-tree.json', []);
const INDEX = load('ksco-index.json', []);
const DESC = load('ksco-desc.json', {});

const LV_NAME = { 1: '대분류', 2: '중분류', 3: '소분류', 4: '세분류', 5: '세세분류' };

const NODES = new Map();
const CHILDREN = new Map();
const CODE_TERMS = new Map();
const REFS_IN = new Map();

for (const n of TREE) NODES.set(n.code, { code: n.code, name: n.name, level: n.level, parent: n.parent || null });
for (const n of NODES.values()) {
  if (n.parent) {
    if (!CHILDREN.has(n.parent)) CHILDREN.set(n.parent, []);
    CHILDREN.get(n.parent).push(n.code);
  }
}
for (const arr of CHILDREN.values()) arr.sort();
for (const r of INDEX) {
  const code = r.code || r[0];
  const term = r.term || r[1];
  if (!code || !term) continue;
  if (!CODE_TERMS.has(code)) CODE_TERMS.set(code, []);
  CODE_TERMS.get(code).push(term);
}
for (const code in DESC) {
  const d = DESC[code].d;
  if (!d) continue;
  const seen = new Set();
  for (const m of d.matchAll(/\d{4,5}/g)) {
    const ref = m[0];
    if (ref === code || seen.has(ref) || !NODES.has(ref)) continue;
    seen.add(ref);
    if (!REFS_IN.has(ref)) REFS_IN.set(ref, []);
    REFS_IN.get(ref).push(code);
  }
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const codeLink = (c) => { const n = NODES.get(c); return n ? `<a href="/job/${c}">${esc(c)} ${esc(n.name)}</a>` : esc(c); };

function pathOf(code) {
  const parts = [];
  let cur = NODES.get(code);
  while (cur) { parts.unshift(cur); cur = cur.parent ? NODES.get(cur.parent) : null; }
  return parts;
}

function descBlock(code) {
  const d = DESC[code];
  if (!d || !d.d) return '';
  const lines = d.d.split('\n').map((line) => {
    if (line === '[예시]' || line === '[직업예시]') return '<div class="sec inc">직업 예시</div>';
    if (line === '[제외]') return '<div class="sec exc">제외</div>';
    if (line === '[직무개요]' || line === '[직무 개요]') return '<div class="sec inc">직무 개요</div>';
    // 통계청 원문에 다른 구분자가 섞여 나와도 대괄호 표기가 그대로 노출되지 않게 한다.
    if (/^\[[^\]]{1,12}\]$/.test(line)) return `<div class="sec inc">${esc(line.slice(1, -1))}</div>`;
    const html = esc(line).replace(/(\d{4,5})/g, (m) => (NODES.has(m) ? `<a href="/job/${m}">${m}</a>` : m));
    return `<div>${html}</div>`;
  }).join('');
  return `<div class="descbox">${lines}</div>`;
}

function CODES_ALL() { return [...NODES.keys()]; }
function hasCode(c) { return NODES.has(c); }
function sectionsNavHtml() {
  const secs = [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code));
  return secs.map((n) => `<a href="/job/${n.code}">${esc(n.code)}. ${esc(n.name)}</a>`).join('\n');
}

// 광고 슬롯·사이드바는 codepage와 공유
let adSlotHtml = () => '';
let sidebarsFn = () => ({ left: '', right: '' });
let sidebarCss = '';
let headerNav = () => '';
let headerCss = '';
function setHeader(fn, css) { headerNav = fn; headerCss = css || ''; }
function setAdSlot(fn) { adSlotHtml = fn; }
function setSidebars(fn, css) { sidebarsFn = fn; sidebarCss = css || ''; }

// 직업분류 전용 좌측 네비(현재 경로 펼침) — 산업분류 사이드바의 카테고리 부분을 대체
function jobNavHtml(currentCode) {
  const openSet = new Set();
  if (currentCode && NODES.has(currentCode)) {
    let cur = NODES.get(currentCode);
    while (cur) { openSet.add(cur.code); cur = cur.parent ? NODES.get(cur.parent) : null; }
  }
  const render = (code, depth) => {
    const n = NODES.get(code);
    const kids = CHILDREN.get(code) || [];
    const isOpen = openSet.has(code);
    const cls = `sn-item${code === currentCode ? ' sn-cur' : ''}${depth > 0 ? ' sn-d' + Math.min(depth, 3) : ''}`;
    const caret = kids.length ? `<span class="sn-caret">${isOpen ? '▾' : '▸'}</span>` : '<span class="sn-caret"></span>';
    let html = `<a class="${cls}" href="/job/${code}">${caret}<b>${esc(code)}</b> ${esc(n.name)}</a>`;
    if (isOpen && kids.length && depth < 4) html += kids.map((k) => render(k, depth + 1)).join('');
    return html;
  };
  return [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code))
    .map((s) => render(s.code, 0)).join('\n');
}

function jobSidebars(currentCode) {
  const base = sidebarsFn({ active: 'job' });
  const left = `<aside class="side side-left">
  <div class="side-box">
    <div class="side-title">직업 분류</div>
    <nav class="side-nav side-tree">${jobNavHtml(currentCode)}</nav>
  </div>
  <div class="side-box">
    <div class="side-title">바로가기</div>
    <nav class="side-nav">
      <a href="/" class="sn-item">🔎 산업분류코드 검색</a>
      <a href="/job" class="sn-item sn-on">👔 직업분류코드(KSCO)</a>
    </nav>
  </div>
</aside>`;
  return { left, right: base.right };
}

function renderJobPage(code, siteUrl) {
  const node = NODES.get(code);
  if (!node) return null;
  const p = pathOf(code);
  const isLeaf = !(CHILDREN.get(code) || []).length;
  const url = `${siteUrl}/job/${code}`;
  const d = DESC[code];
  const defText = d && d.d ? d.d.replace(/\n\[[^\]]+\]\n/g, ' ').replace(/\n/g, ' ').slice(0, 150) : '';

  const metaDesc = isLeaf
    ? `${node.name}(직업분류코드 ${code}) 한국표준직업분류 KSCO 8차 정보. ${defText || '직무 개요, 직업 예시, 색인어, 관련 직업분류.'}`
    : `${node.name}(${code}) ${LV_NAME[node.level]} 직업분류코드. 하위 분류 ${(CHILDREN.get(code) || []).length}개와 한국표준직업분류(KSCO 8차) 세부 직업코드 목록.`;

  const breadcrumbHtml = p.map((n, i) => (i === p.length - 1 ? `<span>${esc(n.code)} ${esc(n.name)}</span>` : `<a href="/job/${n.code}">${esc(n.name)}</a>`)).join(' › ');
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: '직업분류코드 조회', item: `${siteUrl}/job` },
      ...p.map((n, i) => ({ '@type': 'ListItem', position: i + 2, name: `${n.code} ${n.name}`, item: `${siteUrl}/job/${n.code}` }))],
  };

  let body = '';
  const clean = (s) => {
    let t = s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (/^(?:\S ){1,}\S$/.test(t) && t.split(' ').every((w) => w.length === 1)) t = t.replace(/ /g, '');
    return t;
  };
  if (isLeaf) {
    const trail = p.map((n) => clean(n.name)).slice(0, -1).join(' › ');
    body += `<p class="lead"><b>${esc(node.name)}</b>의 한국표준직업분류(KSCO) 8차 <b>직업분류코드는 ${esc(code)}</b>입니다.
      ${esc(trail)} 아래 ${LV_NAME[node.level]}로 분류됩니다.</p>`;
  } else {
    body += `<p class="lead"><b>${esc(node.name)}</b>(코드 <b>${esc(code)}</b>)은 한국표준직업분류(KSCO) 8차의 ${LV_NAME[node.level]}입니다.
      아래에서 하위 ${(CHILDREN.get(code) || []).length}개 분류와 각 직업코드를 확인할 수 있습니다.</p>`;
  }
  if (d && d.e) body += `<p class="eng">${esc(d.e)}</p>`;
  body += descBlock(code);

  const kids = CHILDREN.get(code) || [];
  if (kids.length) {
    body += `<h2>하위 분류 (${kids.length}개)</h2><ul class="linklist">${kids.map((k) => `<li>${codeLink(k)}</li>`).join('')}</ul>`;
  }
  if (isLeaf) {
    const terms = CODE_TERMS.get(code) || [];
    if (terms.length) body += `<h2>색인어·관련 직업명 (${terms.length}개)</h2><p class="terms">${terms.map((t) => esc(t)).join(' · ')}</p>`;
    const sibs = (CHILDREN.get(node.parent) || []).filter((c) => c !== code);
    if (sibs.length) body += `<h2>같은 분류 내 다른 직업코드</h2><ul class="linklist">${sibs.map((c) => `<li>${codeLink(c)}</li>`).join('')}</ul>`;
    const ins = REFS_IN.get(code) || [];
    if (ins.length) body += `<h2>이 코드로 안내하는 분류</h2><ul class="linklist">${ins.map((c) => `<li>${codeLink(c)}</li>`).join('')}</ul>`;
  }

  const faqLd = isLeaf ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: `${node.name}의 직업분류코드는?`, acceptedAnswer: { '@type': 'Answer', text: `${node.name}의 한국표준직업분류(KSCO 8차) 코드는 ${code}입니다.` } }],
  } : null;

  const title = isLeaf
    ? `${node.name} 직업분류코드 ${code} | KSCO 8차 한국표준직업분류`
    : `${node.name} (${code}) ${LV_NAME[node.level]} 직업분류코드 | KSCO 8차`;

  const SB = jobSidebars(code);

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
  .top{background:linear-gradient(135deg,#0f7a5a,#16a37b);color:#fff;padding:16px;border-radius:12px;display:flex;gap:14px;flex-wrap:wrap}
  .top a{color:#d9f5ea;text-decoration:none;font-size:13px}
  .bc{font-size:12.5px;color:#6b7684;margin:14px 2px}
  .bc a{color:#4a5568;text-decoration:none}.bc a:hover{color:#16a37b}
  h1{font-size:22px;margin:6px 0 2px}
  h1 .c{font-family:Consolas,monospace;color:#16a37b}
  .lv{display:inline-block;font-size:12px;background:#e7f6f0;color:#0f7a5a;border-radius:20px;padding:2px 9px;margin-left:6px;vertical-align:middle}
  h2{font-size:16px;margin:24px 0 8px;border-top:1px solid #e2e7ef;padding-top:16px}
  .eng{color:#8a94a3;font-style:italic;margin:2px 0 0}
  .lead{font-size:14.5px;line-height:1.75;color:#2b3648;background:#f0faf6;border:1px solid #cdebe0;border-radius:10px;padding:12px 14px;margin:12px 0 4px}
  .descbox{background:#fff;border:1px solid #eef1f6;border-radius:10px;padding:12px 14px;font-size:14px}
  .descbox .sec{font-weight:700;font-size:12px;margin:8px 0 2px}
  .descbox .sec.inc{color:#2b7a3d}.descbox .sec.exc{color:#c05621}
  .descbox a,.linklist a{color:#16a37b;text-decoration:none}
  .descbox a:hover,.linklist a:hover{text-decoration:underline}
  .linklist{list-style:none;padding:0;margin:0;columns:2;font-size:14px}
  .linklist li{margin:3px 0;break-inside:avoid}
  .terms{font-size:13.5px;color:#4a5568}
  .ad-slot{margin-top:26px;padding:12px;border:1px solid #eef1f6;border-radius:12px;background:#fbfcfe;text-align:center}
  .ad-label{font-size:11px;color:#b3bac6;margin-bottom:8px;letter-spacing:.3px}
  .ad-disc{font-size:11px;color:#9aa3b0;margin-top:8px}
  footer{margin-top:30px;font-size:11.5px;color:#9aa3b0;text-align:center}
  .sn-item:hover{color:#16a37b !important}
  .sn-cur{background:#e7f6f0 !important;color:#0f7a5a !important}
${headerCss}
${sidebarCss}
</style>
</head>
<body>
${headerNav("job")}
<div class="layout">
${SB.left}
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회</a><a href="/job">직업분류코드 목록</a></div>
  <nav class="bc">${breadcrumbHtml}</nav>
  <h1><span class="c">${esc(code)}</span> ${esc(node.name)}<span class="lv">${LV_NAME[node.level]}</span></h1>
  ${body}
  ${adSlotHtml()}
  <footer>출처: 통계청 한국표준직업분류(KSCO 8차) · 참고용</footer>
</div>
${SB.right}
</div>
</body>
</html>`;
}

// /job 인덱스 페이지
function renderJobIndex(siteUrl) {
  const secs = [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code));
  const leaves = [...NODES.values()].filter((n) => n.level === 5).length;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>직업분류코드 조회 | 한국표준직업분류 KSCO 8차 전체 목록</title>
<meta name="description" content="한국표준직업분류(KSCO) 8차 직업분류코드를 조회하세요. 대분류 10개부터 세세분류 ${leaves}개까지 직무 개요·직업 예시·색인어를 코드별로 제공합니다." />
<link rel="canonical" href="${siteUrl}/job" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="직업분류코드 조회 | KSCO 8차" />
<meta property="og:url" content="${siteUrl}/job" />
<style>
  body{font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1c2430;background:#f4f6fa;margin:0;line-height:1.6}
  .wrap{max-width:780px;margin:0 auto;padding:16px 16px 60px}
  .top{background:linear-gradient(135deg,#0f7a5a,#16a37b);color:#fff;padding:20px 16px;border-radius:12px}
  .top h1{margin:0;font-size:21px}
  .top p{margin:6px 0 0;font-size:13px;opacity:.9}
  .top a{color:#d9f5ea;font-size:13px}
  .sec{background:#fff;border:1px solid #e2e7ef;border-radius:12px;padding:14px 16px;margin-top:14px}
  .sec a{color:#16a37b;text-decoration:none;font-weight:600}
  .sec a:hover{text-decoration:underline}
  .kids{margin-top:6px;font-size:13.5px;color:#4a5568}
  .kids a{color:#4a5568;font-weight:400}
  footer{margin-top:26px;font-size:11.5px;color:#9aa3b0;text-align:center}
  .sn-item:hover{color:#16a37b !important}
${headerCss}
${sidebarCss}
</style>
</head>
<body>
${headerNav("job")}
<div class="layout">
${jobSidebars('').left}
<div class="wrap">
  <div class="top">
    <h1>직업분류코드 조회 (KSCO 8차)</h1>
    <p>한국표준직업분류 대분류 10개 · 세세분류 ${leaves}개. 코드별 직무 개요·직업 예시·색인어 제공.</p>
    <p><a href="/">← 산업분류코드 조회로</a></p>
  </div>
  ${secs.map((s) => {
    const kids = (CHILDREN.get(s.code) || []).slice(0, 12);
    return `<div class="sec"><a href="/job/${s.code}">${esc(s.code)}. ${esc(s.name)}</a>
      <div class="kids">${kids.map((k) => `<a href="/job/${k}">${esc(k)} ${esc(NODES.get(k).name)}</a>`).join(' · ')}</div></div>`;
  }).join('')}
  ${adSlotHtml()}
  <footer>출처: 통계청 한국표준직업분류(KSCO 8차) · 참고용</footer>
</div>
${jobSidebars('').right}
</div>
</body>
</html>`;
}

module.exports = { renderJobPage, renderJobIndex, CODES_ALL, hasCode, sectionsNavHtml, setAdSlot, setSidebars, setHeader, count: () => NODES.size };
