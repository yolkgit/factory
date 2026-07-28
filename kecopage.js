// 한국고용직업분류(KECO 2025) 코드별 SSR 페이지 생성기.
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const load = (f, fb) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch (e) { return fb; } };

const TREE = load('keco-tree.json', []);
const LV_NAME = { 1: '대분류', 2: '중분류', 3: '소분류', 4: '세분류' };

const NODES = new Map();
const CHILDREN = new Map();
for (const n of TREE) NODES.set(n.code, { code: n.code, name: n.name, level: n.level, parent: n.parent || null });
for (const n of NODES.values()) {
  if (n.parent) { if (!CHILDREN.has(n.parent)) CHILDREN.set(n.parent, []); CHILDREN.get(n.parent).push(n.code); }
}
for (const a of CHILDREN.values()) a.sort();

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const codeLink = (c) => { const n = NODES.get(c); return n ? `<a href="/keco/${c}">${esc(c)} ${esc(n.name)}</a>` : esc(c); };
function pathOf(code) { const p = []; let cur = NODES.get(code); while (cur) { p.unshift(cur); cur = cur.parent ? NODES.get(cur.parent) : null; } return p; }

let adSlotHtml = () => '';
let sidebarCss = '';
function setDeps(adFn, css) { adSlotHtml = adFn; sidebarCss = css || ''; }

function kecoNavHtml(currentCode) {
  const open = new Set();
  if (currentCode && NODES.has(currentCode)) { let c = NODES.get(currentCode); while (c) { open.add(c.code); c = c.parent ? NODES.get(c.parent) : null; } }
  const render = (code, depth) => {
    const n = NODES.get(code); const kids = CHILDREN.get(code) || [];
    const isOpen = open.has(code);
    const cls = `sn-item${code === currentCode ? ' sn-cur' : ''}${depth > 0 ? ' sn-d' + Math.min(depth, 3) : ''}`;
    const caret = kids.length ? `<span class="sn-caret">${isOpen ? '▾' : '▸'}</span>` : '<span class="sn-caret"></span>';
    let h = `<a class="${cls}" href="/keco/${code}">${caret}<b>${esc(code)}</b> ${esc(n.name)}</a>`;
    if (isOpen && kids.length && depth < 3) h += kids.map((k) => render(k, depth + 1)).join('');
    return h;
  };
  return [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code)).map((s) => render(s.code, 0)).join('\n');
}

function sidebars(currentCode) {
  return `<aside class="side side-left">
  <div class="side-box">
    <div class="side-title">고용직업 분류</div>
    <nav class="side-nav side-tree">${kecoNavHtml(currentCode)}</nav>
  </div>
  <div class="side-box">
    <div class="side-title">바로가기</div>
    <nav class="side-nav">
      <a href="/" class="sn-item">🔎 산업분류코드 검색</a>
      <a href="/job" class="sn-item">👔 표준직업분류(KSCO)</a>
      <a href="/keco" class="sn-item sn-on">🧭 고용직업분류(KECO)</a>
    </nav>
  </div>
</aside>`;
}

const PAGE_CSS = (extra) => `
  body{font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1c2430;background:#f4f6fa;margin:0;line-height:1.6}
  .wrap{max-width:780px;margin:0 auto;padding:16px 16px 60px}
  .top{background:linear-gradient(135deg,#6b3fa0,#8b5cc7);color:#fff;padding:16px;border-radius:12px;display:flex;gap:14px;flex-wrap:wrap}
  .top a{color:#e8dcf7;text-decoration:none;font-size:13px}
  .bc{font-size:12.5px;color:#6b7684;margin:14px 2px}
  .bc a{color:#4a5568;text-decoration:none}.bc a:hover{color:#8b5cc7}
  h1{font-size:22px;margin:6px 0 2px}
  h1 .c{font-family:Consolas,monospace;color:#8b5cc7}
  .lv{display:inline-block;font-size:12px;background:#f2ebfa;color:#6b3fa0;border-radius:20px;padding:2px 9px;margin-left:6px;vertical-align:middle}
  h2{font-size:16px;margin:24px 0 8px;border-top:1px solid #e2e7ef;padding-top:16px}
  .lead{font-size:14.5px;line-height:1.75;color:#2b3648;background:#f8f4fd;border:1px solid #e4d7f5;border-radius:10px;padding:12px 14px;margin:12px 0 4px}
  .linklist{list-style:none;padding:0;margin:0;columns:2;font-size:14px}
  .linklist li{margin:3px 0;break-inside:avoid}
  .linklist a{color:#8b5cc7;text-decoration:none}
  .linklist a:hover{text-decoration:underline}
  .sn-item:hover{color:#8b5cc7 !important}
  .sn-cur{background:#f2ebfa !important;color:#6b3fa0 !important}
  .ad-slot{margin-top:26px;padding:12px;border:1px solid #eef1f6;border-radius:12px;background:#fbfcfe;text-align:center}
  .ad-label{font-size:11px;color:#b3bac6;margin-bottom:8px}
  .ad-disc{font-size:11px;color:#9aa3b0;margin-top:8px}
  footer{margin-top:30px;font-size:11.5px;color:#9aa3b0;text-align:center}
${extra}
`;

function renderKecoPage(code, siteUrl) {
  const node = NODES.get(code);
  if (!node) return null;
  const p = pathOf(code);
  const kids = CHILDREN.get(code) || [];
  const isLeaf = !kids.length;
  const url = `${siteUrl}/keco/${code}`;
  const trail = p.map((n) => n.name).slice(0, -1).join(' › ');

  const title = isLeaf
    ? `${node.name} 고용직업분류코드 ${code} | KECO 한국고용직업분류`
    : `${node.name} (${code}) ${LV_NAME[node.level]} 고용직업분류 | KECO`;
  const metaDesc = isLeaf
    ? `${node.name}의 한국고용직업분류(KECO) 코드는 ${code}입니다. ${trail} 아래 ${LV_NAME[node.level]}로 분류되며, 워크넷·고용정보 통계에 사용됩니다.`
    : `${node.name}(${code}) ${LV_NAME[node.level]} 고용직업분류코드. 하위 ${kids.length}개 분류와 세부 직업코드 목록.`;

  const bcLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: '고용직업분류 조회', item: `${siteUrl}/keco` },
      ...p.map((n, i) => ({ '@type': 'ListItem', position: i + 2, name: `${n.code} ${n.name}`, item: `${siteUrl}/keco/${n.code}` }))],
  };
  const faqLd = isLeaf ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: `${node.name}의 고용직업분류 코드는?`, acceptedAnswer: { '@type': 'Answer', text: `${node.name}의 한국고용직업분류(KECO) 코드는 ${code}입니다.` } }],
  } : null;

  let body = isLeaf
    ? `<p class="lead"><b>${esc(node.name)}</b>의 한국고용직업분류(KECO) <b>코드는 ${esc(code)}</b>입니다. ${esc(trail)} 아래 ${LV_NAME[node.level]}로 분류됩니다.</p>`
    : `<p class="lead"><b>${esc(node.name)}</b>(코드 <b>${esc(code)}</b>)은 한국고용직업분류(KECO)의 ${LV_NAME[node.level]}입니다. 아래에서 하위 ${kids.length}개 분류를 확인할 수 있습니다.</p>`;
  if (kids.length) body += `<h2>하위 분류 (${kids.length}개)</h2><ul class="linklist">${kids.map((k) => `<li>${codeLink(k)}</li>`).join('')}</ul>`;
  const sibs = node.parent ? (CHILDREN.get(node.parent) || []).filter((c) => c !== code) : [];
  if (sibs.length) body += `<h2>같은 분류 내 다른 직업</h2><ul class="linklist">${sibs.map((c) => `<li>${codeLink(c)}</li>`).join('')}</ul>`;

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}" />
<link rel="canonical" href="${url}" /><link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="article" /><meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(metaDesc)}" /><meta property="og:url" content="${url}" />
<meta property="og:site_name" content="산업분류코드 조회" /><meta property="og:locale" content="ko_KR" />
<script type="application/ld+json">${JSON.stringify(bcLd)}</script>
${faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ''}
<style>${PAGE_CSS(sidebarCss)}</style>
</head><body>
<div class="layout">
${sidebars(code)}
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회</a><a href="/keco">고용직업분류 목록</a></div>
  <nav class="bc">${p.map((n, i) => (i === p.length - 1 ? `<span>${esc(n.code)} ${esc(n.name)}</span>` : `<a href="/keco/${n.code}">${esc(n.name)}</a>`)).join(' › ')}</nav>
  <h1><span class="c">${esc(code)}</span> ${esc(node.name)}<span class="lv">${LV_NAME[node.level]}</span></h1>
  ${body}
  ${adSlotHtml()}
  <footer>출처: 통계청 한국고용직업분류(KECO 2025) · 참고용</footer>
</div>
</div>
</body></html>`;
}

function renderKecoIndex(siteUrl) {
  const secs = [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code));
  const leaves = [...NODES.values()].filter((n) => n.level === 4).length;
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>고용직업분류 조회 | 한국고용직업분류 KECO 전체 목록</title>
<meta name="description" content="한국고용직업분류(KECO) 코드를 조회하세요. 대분류 10개부터 세분류 ${leaves}개까지 직업코드를 제공합니다. 워크넷·고용정보 통계 기준." />
<link rel="canonical" href="${siteUrl}/keco" /><link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" /><meta property="og:title" content="고용직업분류 조회 | KECO" />
<meta property="og:url" content="${siteUrl}/keco" />
<style>${PAGE_CSS(sidebarCss)}
  .sec{background:#fff;border:1px solid #e2e7ef;border-radius:12px;padding:14px 16px;margin-top:14px}
  .sec a{color:#8b5cc7;text-decoration:none;font-weight:600}
  .kids{margin-top:6px;font-size:13.5px;color:#4a5568}
  .kids a{color:#4a5568;font-weight:400}
</style>
</head><body>
<div class="layout">
${sidebars('')}
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회</a><a href="/job">표준직업분류(KSCO)</a></div>
  <h1>고용직업분류 조회 (KECO)</h1>
  <p class="lead">한국고용직업분류(KECO)는 노동시장 상황과 수요에 맞춰 직업을 분류한 체계로, 워크넷 등 고용서비스와 고용통계에 사용됩니다. 대분류 10개 · 세분류 ${leaves}개.</p>
  ${secs.map((s) => {
    const kids = (CHILDREN.get(s.code) || []).slice(0, 12);
    return `<div class="sec"><a href="/keco/${s.code}">${esc(s.code)}. ${esc(s.name)}</a>
      <div class="kids">${kids.map((k) => `<a href="/keco/${k}">${esc(k)} ${esc(NODES.get(k).name)}</a>`).join(' · ')}</div></div>`;
  }).join('')}
  ${adSlotHtml()}
  <footer>출처: 통계청 한국고용직업분류(KECO 2025) · 참고용</footer>
</div>
</div>
</body></html>`;
}

module.exports = { renderKecoPage, renderKecoIndex, CODES_ALL: () => [...NODES.keys()], hasCode: (c) => NODES.has(c), setDeps, count: () => NODES.size };
