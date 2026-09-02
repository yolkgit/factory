// 산업분류코드별 SSR(서버렌더링) 페이지 생성기.
// 크롤러·AI가 각 코드의 전체 내용을 읽도록 정적 HTML을 생성하고, 내부링크로 촘촘히 연결한다.
const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'ksic-data.json'), 'utf8'));

// 쿠팡 파트너스 광고 슬롯(ad-slot.html) — 주석만 있으면 미표시. 광고 시 법정 고지문구 자동 부착.
let AD_RAW = '';
try { AD_RAW = fs.readFileSync(path.join(__dirname, 'ad-slot.html'), 'utf8'); } catch (e) { AD_RAW = ''; }
function adSlotHtml() {
  const stripped = AD_RAW.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!stripped) return '';
  return `<div class="ad-slot"><div class="ad-label">광고 · 쿠팡 파트너스</div>${AD_RAW}` +
    `<div class="ad-disc">본 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다.</div></div>`;
}

// 우측 사이드바용 세로형 쿠팡 배너(같은 트래킹코드, 세로 템플릿)
const AD_SIDE_ID = process.env.COUPANG_SIDE_ID || '965621';
const AD_TRACKING = process.env.COUPANG_TRACKING || 'AF6584316';
function adSideHtml() {
  const stripped = AD_RAW.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!stripped) return ''; // 광고 미설정 시 사이드 광고도 미표시
  return `<iframe src="https://ads-partners.coupang.com/widgets.html?id=${AD_SIDE_ID}&template=carousel&trackingCode=${AD_TRACKING}&subId=&width=160&height=600&tsource=" width="160" height="600" frameborder="0" scrolling="no" referrerpolicy="unsafe-url" browsingtopics></iframe>` +
    `<div class="side-ad-disc">쿠팡 파트너스 활동으로 일정액의 수수료를 제공받습니다.</div>`;
}

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

  // ---- AI 인용·연관검색어 대응: 실제 검색되는 질문 패턴을 데이터로 답변 생성 ----
  const qa = [];
  if (isLeaf) {
    const nm = node.name;
    qa.push({
      q: `${nm}의 산업분류코드는?`,
      a: `${nm}의 한국표준산업분류(KSIC) 11차 산업분류코드는 ${code}입니다. ${p.map((n) => cleanName(n.name)).slice(0, -1).join(' › ')} 아래 ${LV_NAME[node.level]}에 속합니다.`,
    });
    qa.push({
      q: `산업분류코드 ${code}은 어떤 업종인가요?`,
      a: `산업분류코드 ${code}은 ${nm}입니다.${desc5 && desc5.d ? ' ' + desc5.d.split('\n')[0] : ''}`,
    });
    const olds = NEW2OLD.get(code) || [];
    if (olds.length && olds[0].old !== code) {
      qa.push({
        q: `${nm}의 10차 산업분류코드는?`,
        a: `${nm}은 구 분류(10차) 기준 ${olds.map((o) => o.old).join(', ')}이며, 11차 개정으로 ${code}으로 변경되었습니다.`,
      });
    } else if (olds.length) {
      qa.push({ q: `${nm}은 10차와 11차 코드가 같나요?`, a: `네. ${nm}은 10차와 11차 모두 ${code}으로 동일합니다.` });
    }
    // 해설 기반 포함/제외 (AI가 가장 인용하기 좋은 정보)
    if (desc5 && desc5.d) {
      const lines = desc5.d.split('\n');
      const exIdx = lines.indexOf('[예시]');
      const exclIdx = lines.indexOf('[제외]');
      if (exIdx > -1) {
        const items = lines.slice(exIdx + 1, exclIdx > -1 ? exclIdx : undefined).filter((l) => l.startsWith('·')).map((l) => l.replace(/^·/, '').trim());
        if (items.length) qa.push({ q: `${nm}(${code})에 포함되는 활동은?`, a: `${nm}에는 ${items.slice(0, 6).join(', ')} 등이 포함됩니다.` });
      }
      if (exclIdx > -1) {
        const items = lines.slice(exclIdx + 1).filter((l) => l.startsWith('·')).map((l) => l.replace(/^·/, '').trim());
        if (items.length) qa.push({ q: `${nm}(${code})에서 제외되는 것은?`, a: `${items.slice(0, 5).join(' / ')}은(는) ${nm}에서 제외되며 별도 코드로 분류됩니다.` });
      }
    }
    // 국세청 업종코드·경비율 (종합소득세 시즌 검색량 큼)
    const ups = UPJONG_BY_K.get(code) || [];
    if (ups.length) {
      qa.push({ q: `${nm}의 국세청 업종코드는?`, a: `${nm}(산업분류코드 ${code})에 연계되는 국세청 업종코드는 ${ups.slice(0, 5).map((o) => `${o.u}(${o.un})`).join(', ')}입니다.` });
      const withRate = ups.filter((o) => GYEONGBI[o.u]);
      if (withRate.length) {
        const g = GYEONGBI[withRate[0].u];
        qa.push({
          q: `${nm}의 단순경비율·기준경비율은?`,
          a: `국세청 업종코드 ${withRate[0].u}(${withRate[0].un}) 기준 2025년 귀속 단순경비율은 ${g[0]}%${g[1] ? `(초과율 ${g[1]}%)` : ''}, 기준경비율은 ${g[2]}%입니다. 경비율은 종합소득세 추계신고에 쓰는 세무상 비율이며 실제 마진율이 아닙니다.`,
        });
      }
    }
    const sj = sanjaeRate(code);
    if (sj) qa.push({ q: `${nm}의 산재보험료율은?`, a: `${nm}은 ${sj.label ? sj.label + ' 기준 ' : ''}2026년도 산재보험료율 약 ${sj.rate}‰(1,000분의 ${sj.rate})가 적용됩니다. 근로복지공단 사업종류 기준 근사값이며 정확한 요율은 사업종류 예시표에서 확인하세요.` });
    const sme = smeInfo(code);
    if (sme) {
      const parts = [];
      if (sme.sme !== undefined) parts.push(`중소기업은 평균매출액 ${sme.sme.toLocaleString()}억원 이하`);
      if (sme.small !== undefined) parts.push(`소기업은 ${sme.small.toLocaleString()}억원 이하`);
      qa.push({ q: `${nm}의 중소기업 기준 매출은?`, a: `중소기업기본법 시행령상 ${nm}은 ${parts.join(', ')}입니다. 지원사업·규제 판정에 쓰이는 기준으로 업종 평균매출이 아닙니다.` });
    }
    qa.push({
      q: `${nm} 공장·업체는 어디서 찾나요?`,
      a: `산업분류코드 ${code}으로 전국 등록공장을 조회할 수 있습니다. 회사명·생산품·지역별 검색과 경쟁 밀도·규모 분포 확인이 가능합니다.`,
    });
  } else {
    qa.push({ q: `${node.name}(${code})은 무엇인가요?`, a: `${node.name}(코드 ${code})은 한국표준산업분류(KSIC) 11차의 ${LV_NAME[node.level]}이며, 하위에 ${(CHILDREN.get(code) || []).length}개 분류가 있습니다.` });
    const kidsList = (CHILDREN.get(code) || []).slice(0, 8).map((k) => `${k} ${NODES.get(k).name}`);
    if (kidsList.length) qa.push({ q: `${node.name}에는 어떤 업종이 있나요?`, a: `${kidsList.join(', ')} 등이 있습니다.` });
  }

  let body = '';
  if (desc5 && desc5.e) body += `<p class="eng">${esc(desc5.e)}</p>`;

  // 검색 의도에 답하는 요약 문장(리드) — 크롤러·AI가 인용하기 좋은 형태
  if (isLeaf) {
    const oldsL = NEW2OLD.get(code) || [];
    const oldTxt = oldsL.length && oldsL[0].old !== code
      ? ` 구 분류(10차) 기준 코드는 ${oldsL.map((o) => o.old).join(', ')}입니다.`
      : (oldsL.length ? ' 10차(구 분류)에서도 같은 코드를 사용합니다.' : '');
    const upsL = UPJONG_BY_K.get(code) || [];
    const upTxt = upsL.length ? ` 국세청 업종코드는 ${upsL.slice(0, 3).map((o) => o.u).join(', ')}${upsL.length > 3 ? ' 등' : ''}에 연계됩니다.` : '';
    // 상위 경로명에서 괄호 범위표기 제거 + 통계청 원문의 자간 공백 정리 (예: "제 조 업(10~34)" → "제조업")
    const clean = (s) => {
      let t = s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      // "제 조 업"처럼 한 글자씩 띄운 표기를 붙임 (2글자 이상 단어는 보존)
      if (/^(?:\S ){1,}\S$/.test(t) && t.split(' ').every((w) => w.length === 1)) t = t.replace(/ /g, '');
      return t;
    };
    const trail = p.map((n) => clean(n.name)).slice(0, -1).join(' › ');
    body += `<p class="lead"><b>${esc(node.name)}</b>의 한국표준산업분류(KSIC) 11차 <b>산업분류코드는 ${esc(code)}</b>입니다.
      ${esc(trail)} 아래 ${LV_NAME[node.level]}로 분류됩니다.${oldTxt}${upTxt}</p>`;
  } else {
    body += `<p class="lead"><b>${esc(node.name)}</b>(코드 <b>${esc(code)}</b>)은 한국표준산업분류(KSIC) 11차의 ${LV_NAME[node.level]}입니다.
      아래에서 하위 ${(CHILDREN.get(code) || []).length}개 분류와 각 업종코드를 확인할 수 있습니다.</p>`;
  }

  // 핵심 요약표 — AI가 사실을 그대로 추출하기 좋은 key-value 형태
  if (isLeaf) {
    const rows = [];
    rows.push(['산업분류코드(11차)', esc(code)]);
    rows.push(['분류명', esc(node.name)]);
    if (desc5 && desc5.e) rows.push(['영문명', esc(desc5.e)]);
    rows.push(['분류 수준', LV_NAME[node.level]]);
    const oldsS = NEW2OLD.get(code) || [];
    if (oldsS.length) rows.push(['10차 코드', oldsS[0].old === code ? `${esc(code)} (동일)` : esc(oldsS.map((o) => o.old).join(', '))]);
    const upsS = UPJONG_BY_K.get(code) || [];
    if (upsS.length) rows.push(['국세청 업종코드', esc(upsS.slice(0, 3).map((o) => o.u).join(', ')) + (upsS.length > 3 ? ' 외' : '')]);
    const gS = upsS.map((o) => GYEONGBI[o.u]).find(Boolean);
    if (gS) rows.push(['경비율(2025 귀속)', `단순 ${gS[0]}% · 기준 ${gS[2]}%`]);
    const sjS = sanjaeRate(code);
    if (sjS) rows.push(['산재보험료율(2026)', `${sjS.rate}‰`]);
    const smeS = smeInfo(code);
    if (smeS && smeS.sme !== undefined) rows.push(['중소기업 기준', `평균매출액 ${smeS.sme.toLocaleString()}억원 이하`]);
    body += `<table class="factbox"><caption>${esc(node.name)} 핵심 정보 요약</caption><tbody>` +
      rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('') + `</tbody></table>`;
  }

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

  // 자주 묻는 질문 — 화면에도 노출해야 AI·검색엔진이 실제 문장을 인용한다
  if (qa.length) {
    body += `<h2>자주 묻는 질문</h2><div class="qa">` +
      qa.map((x) => `<div class="qa-item"><h3 class="qa-q">${esc(x.q)}</h3><p class="qa-a">${esc(x.a)}</p></div>`).join('') +
      `</div>`;
  }

  // 연관 검색·바로가기 — 사용자가 이어서 찾는 것들을 내부링크로 연결
  const relatedLinks = [];
  if (isLeaf) {
    const olds2 = NEW2OLD.get(code) || [];
    relatedLinks.push([`${node.name} 공장·업체 찾기`, `/?q=${code}`]);
    relatedLinks.push([`${node.name} 사업성 검토(경쟁 밀도)`, `/?q=${code}`]);
    if (olds2.length && olds2[0].old !== code) relatedLinks.push([`10차 ${olds2[0].old} → 11차 ${code} 변환`, `/?q=${olds2[0].old}`]);
    const par = NODES.get(node.parent);
    if (par) relatedLinks.push([`${par.name} 전체 코드 보기`, `/code/${par.code}`]);
    relatedLinks.push(['산업분류코드 전체 검색', '/']);
    relatedLinks.push(['직업분류코드(KSCO) 조회', '/job']);
  } else {
    relatedLinks.push(['산업분류코드 검색', '/']);
    if (node.parent) relatedLinks.push([`상위 분류 ${NODES.get(node.parent).name}`, `/code/${node.parent}`]);
    relatedLinks.push(['직업분류코드(KSCO)', '/job']);
    relatedLinks.push(['고용직업분류(KECO)', '/keco']);
  }
  body += `<h2>이런 것도 함께 찾아보세요</h2><div class="rellinks">` +
    relatedLinks.map(([t, u]) => `<a href="${u}">${esc(t)}</a>`).join('') + `</div>`;


  const faqLd = qa.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: qa.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  } : null;

  // 분류 자체를 '정의된 용어'로 선언 → AI가 코드-명칭-정의를 엔티티로 인식
  const termLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${url}#term`,
    name: node.name,
    termCode: code,
    description: (desc5 && desc5.d ? desc5.d.split('\n')[0] : metaDesc).slice(0, 300),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: '한국표준산업분류(KSIC) 11차',
      alternateName: 'Korean Standard Industrial Classification',
      url: `${siteUrl}/`,
      publisher: { '@type': 'GovernmentOrganization', name: '통계청' },
    },
    ...(desc5 && desc5.e ? { alternateName: desc5.e } : {}),
  };

  const title = isLeaf
    ? `${node.name} 산업분류코드 ${code} | KSIC 11차 업종코드·경비율`
    : `${node.name} (${code}) ${LV_NAME[node.level]} 산업분류코드 | KSIC 11차`;

  const SIDEBARS = sidebarsHtml({ currentCode: code, active: 'home' });

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
<script type="application/ld+json">${JSON.stringify(termLd)}</script>
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
  .lead{font-size:14.5px;line-height:1.75;color:#2b3648;background:#f5f9ff;border:1px solid #dde8fb;border-radius:10px;padding:12px 14px;margin:12px 0 4px}
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
  .factbox{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff;border:1px solid #e2e7ef;border-radius:10px;overflow:hidden;margin:12px 0 4px}
  .factbox caption{text-align:left;font-size:12px;color:#8a94a3;padding:8px 12px 4px;font-weight:600}
  .factbox th{text-align:left;background:#f8fafc;color:#4a5568;padding:7px 12px;width:38%;font-weight:600;border-top:1px solid #eef1f6}
  .factbox td{padding:7px 12px;border-top:1px solid #eef1f6;color:#1c2430}
  .qa{margin-top:4px}
  .qa-item{border-bottom:1px solid #eef1f6;padding:10px 0}
  .qa-item:last-child{border-bottom:0}
  .qa-q{font-size:14px;margin:0 0 4px;color:#1c2430}
  .qa-q::before{content:'Q. ';color:#256ef4;font-weight:700}
  .qa-a{font-size:13.5px;margin:0;color:#4a5568;line-height:1.7}
  .qa-a::before{content:'A. ';color:#8a94a3;font-weight:700}
  .rellinks{display:flex;flex-wrap:wrap;gap:7px}
  .rellinks a{font-size:13px;color:#3d4a5c;text-decoration:none;background:#f1f5fb;border:1px solid #e2e9f5;border-radius:8px;padding:5px 11px}
  .rellinks a:hover{border-color:#256ef4;color:#256ef4}
  footer{margin-top:30px;font-size:11.5px;color:#9aa3b0;text-align:center}
${HEADER_CSS}
${SIDEBAR_CSS}
  .ad-slot{margin-top:26px;padding:12px;border:1px solid #eef1f6;border-radius:12px;background:#fbfcfe;text-align:center}
  .ad-label{font-size:11px;color:#b3bac6;margin-bottom:8px;letter-spacing:.3px}
  .ad-disc{font-size:11px;color:#9aa3b0;margin-top:8px}
</style>
</head>
<body>
${headerNavHtml('home')}
<div class="layout">
${SIDEBARS.left}
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회 홈</a></div>
  <nav class="bc">${breadcrumbHtml}</nav>
  <h1><span class="c">${esc(code)}</span> ${esc(node.name)}<span class="lv">${LV_NAME[node.level]}</span></h1>
  ${body}
  ${adSlotHtml()}
  <footer>출처: 통계청 한국표준산업분류(KSIC 11차) · 국세청·고용노동부·한국산업단지공단 자료 기반 · 참고용<br>
    <a href="/about" style="color:#9aa3b0">사이트 소개</a> · <a href="/privacy" style="color:#9aa3b0">개인정보처리방침</a> · <a href="/terms" style="color:#9aa3b0">이용약관</a></footer>
</div>
${SIDEBARS.right}
</div>
</body>
</html>`;
}

// 홈페이지에 주입할 대분류(A~U) 바로가기 링크 HTML
function sectionsNavHtml() {
  const secs = [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code));
  return secs.map((n) => `<a href="/code/${n.code}">${esc(n.code)}. ${esc(n.name.replace(/\(.*\)$/, '').trim())}</a>`).join('\n');
}

// 좌측 사이드바 카테고리 네비게이션.
// currentCode가 주어지면 그 경로를 따라 계층을 펼쳐 하위 분류까지 탐색할 수 있게 렌더한다.
function cleanName(s) {
  let t = String(s).replace(/\([^)]*\)$/, '').replace(/\s+/g, ' ').trim();
  if (/^(?:\S ){1,}\S$/.test(t) && t.split(' ').every((w) => w.length === 1)) t = t.replace(/ /g, '');
  return t;
}
function sideNavHtml(currentCode) {
  const openSet = new Set();
  if (currentCode && NODES.has(currentCode)) {
    let cur = NODES.get(currentCode);
    while (cur) { openSet.add(cur.code); cur = cur.parent ? NODES.get(cur.parent) : null; }
  }
  const render = (code, depth) => {
    const n = NODES.get(code);
    const kids = CHILDREN.get(code) || [];
    const isOpen = openSet.has(code);
    const isCurrent = code === currentCode;
    const cls = `sn-item${isCurrent ? ' sn-cur' : ''}${depth > 0 ? ' sn-d' + Math.min(depth, 3) : ''}`;
    const caret = kids.length ? `<span class="sn-caret">${isOpen ? '▾' : '▸'}</span>` : '<span class="sn-caret"></span>';
    let html = `<a class="${cls}" href="/code/${code}">${caret}<b>${esc(code)}</b> ${esc(cleanName(n.name))}</a>`;
    // 현재 경로상에 있으면 자식까지 펼침(최대 세분류 깊이까지)
    if (isOpen && kids.length && depth < 4) {
      html += kids.map((k) => render(k, depth + 1)).join('');
    }
    return html;
  };
  const secs = [...NODES.values()].filter((n) => n.level === 1).sort((a, b) => a.code.localeCompare(b.code));
  return secs.map((s) => render(s.code, 0)).join('\n');
}

// 모든 페이지 공통 상단 고정 네비게이션.
// 사이드바는 980px 이하에서 숨겨지므로 모바일에서는 이 헤더가 유일한 섹션 이동 수단이다.
const NAV_ITEMS = [
  { key: 'home', href: '/', label: '산업분류코드', icon: '🔎' },
  { key: 'upjong', href: '/upjong', label: '업종코드·경비율', icon: '💰' },
  { key: 'job', href: '/job', label: '표준직업분류', icon: '👔' },
  { key: 'keco', href: '/keco', label: '고용직업분류', icon: '🧭' },
];
function headerNavHtml(active) {
  return `<nav class="gnb"><div class="gnb-in">
  <a class="gnb-brand" href="/">산업분류코드 조회</a>
  <div class="gnb-links">
    ${NAV_ITEMS.map((n) => `<a href="${n.href}" class="gnb-link${active === n.key ? ' on' : ''}"><i>${n.icon}</i>${n.label}</a>`).join('')}
  </div>
</div></nav>`;
}
const HEADER_CSS = `
  .gnb{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e2e7ef;box-shadow:0 1px 3px rgba(20,40,90,.04)}
  .gnb-in{max-width:1400px;margin:0 auto;display:flex;align-items:center;gap:14px;padding:0 14px;height:48px}
  .gnb-brand{font-size:14px;font-weight:800;color:#1a55c4;text-decoration:none;white-space:nowrap}
  .gnb-links{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
  .gnb-links::-webkit-scrollbar{display:none}
  .gnb-link{display:flex;align-items:center;gap:5px;font-size:13px;color:#4a5568;text-decoration:none;padding:7px 11px;border-radius:8px;white-space:nowrap}
  .gnb-link i{font-style:normal;font-size:13px}
  .gnb-link:hover{background:#f1f5fb;color:#256ef4}
  .gnb-link.on{background:#eef3fe;color:#1a55c4;font-weight:700}
  @media(max-width:640px){
    .gnb-in{gap:8px;padding:0 10px;height:46px}
    .gnb-brand{font-size:12.5px}
    .gnb-link{font-size:12.5px;padding:6px 9px}
  }
  @media(max-width:420px){ .gnb-brand{display:none} }
`;

// 모든 페이지 공통 사이드바(좌: 카테고리 · 우: 광고) HTML
function sidebarsHtml(opts) {
  opts = opts || {};
  const cur = opts.currentCode || '';
  const active = (p) => (opts.active === p ? ' sn-on' : '');
  const left = `<aside class="side side-left">
  <div class="side-box">
    <div class="side-title">분류 카테고리</div>
    <nav class="side-nav side-tree">${sideNavHtml(cur)}</nav>
  </div>
  <div class="side-box">
    <div class="side-title">바로가기</div>
    <nav class="side-nav">
      <a href="/" class="sn-item${active('home')}">🔎 산업분류코드 검색</a>
      <a href="/upjong" class="sn-item${active('upjong')}">💰 국세청 업종코드·경비율</a>
      <a href="/job" class="sn-item${active('job')}">👔 표준직업분류(KSCO)</a>
      <a href="/keco" class="sn-item${active('keco')}">🧭 고용직업분류(KECO)</a>
    </nav>
  </div>
</aside>`;
  const ad = adSideHtml();
  const right = ad ? `<aside class="side side-right">
  <div class="side-box side-ad">
    <div class="side-title">추천 상품</div>
    <div class="side-ad-inner">${ad}</div>
  </div>
</aside>` : '';
  return { left, right };
}

// 사이드바 포함 페이지용 공통 CSS
const SIDEBAR_CSS = `
  .layout{display:flex;justify-content:center;align-items:flex-start;gap:18px;max-width:1400px;margin:0 auto}
  .layout>.wrap{flex:1 1 780px;min-width:0;margin:0}
  .side{flex:0 0 200px;position:sticky;top:60px}
  .side-right{flex:0 0 200px}
  .side-box{background:#fff;border:1px solid #e2e7ef;border-radius:12px;padding:12px 13px;margin-bottom:12px}
  .side-title{font-size:12px;font-weight:700;color:#8a94a3;margin-bottom:8px}
  .side-nav{display:flex;flex-direction:column;gap:1px;max-height:64vh;overflow-y:auto}
  .sn-item{display:block;font-size:12.5px;color:#3d4a5c;text-decoration:none;padding:4px 6px;border-radius:7px;line-height:1.35}
  .sn-item:hover{background:#f1f5fb;color:#256ef4}
  .sn-item b{font-family:Consolas,monospace}
  .sn-cur{background:#eef3fe;color:#1a55c4;font-weight:700}
  .sn-on{background:#f1f5fb;font-weight:700}
  .sn-caret{display:inline-block;width:11px;color:#b3bac6;font-size:9px}
  .sn-d1{padding-left:15px}.sn-d2{padding-left:26px}.sn-d3{padding-left:37px}
  .side-nav::-webkit-scrollbar{width:5px}
  .side-nav::-webkit-scrollbar-thumb{background:#dde3ec;border-radius:3px}
  .side-ad-inner{min-height:240px;display:flex;justify-content:center}
  .side-ad-disc{font-size:10.5px;color:#b3bac6;margin-top:7px;line-height:1.5}
  @media(max-width:1180px){.side-right{display:none}}
  @media(max-width:980px){.side-left{display:none}.layout{display:block}.layout>.wrap{margin:0 auto}}
`;

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

module.exports = { renderCodePage, CODES_ALL, sectionsNavHtml, sideNavHtml, sidebarsHtml, SIDEBAR_CSS, headerNavHtml, HEADER_CSS, adSlotHtml, adSideHtml, hasCode: (c) => NODES.has(c), to10th, siblings, getNode };
