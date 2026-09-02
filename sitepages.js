// 사이트 소개 / 개인정보처리방침 / 이용약관 — 애드센스 등 광고 심사에 필요한 필수 페이지.
// 광고 네트워크는 이 페이지들이 없으면 승인을 거부하는 경우가 많다.

const CSS = `
  body{font-family:"Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1c2430;background:#f4f6fa;margin:0;line-height:1.75}
  .wrap{max-width:760px;margin:0 auto;padding:16px 18px 60px}
  .top{background:linear-gradient(135deg,#1a55c4,#256ef4);color:#fff;padding:18px;border-radius:12px}
  .top a{color:#dce7ff;text-decoration:none;font-size:13px}
  h1{font-size:23px;margin:20px 0 6px}
  .upd{font-size:12.5px;color:#9aa3b0;margin-bottom:18px}
  h2{font-size:17px;margin:28px 0 8px;padding-top:16px;border-top:1px solid #e2e7ef}
  p,li{font-size:14.5px;color:#3d4a5c}
  ul{padding-left:20px}
  table{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0 16px;background:#fff}
  th,td{border:1px solid #e2e7ef;padding:9px 12px;text-align:left}
  th{background:#f8fafc;color:#4a5568;font-weight:600}
  .box{background:#fff;border:1px solid #e2e7ef;border-radius:10px;padding:14px 16px;margin:10px 0}
  a{color:#256ef4}
  footer{margin-top:34px;font-size:11.5px;color:#9aa3b0;text-align:center}
  .navlinks{margin-top:14px;font-size:13px}
  .navlinks a{margin-right:14px;text-decoration:none}
`;

const UPDATED = '2026년 9월 2일';

function shell(title, desc, url, body) {
  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="robots" content="index, follow" />
<style>${CSS}</style>
</head><body>
<div class="wrap">
  <div class="top"><a href="/">← 산업분류코드 조회 홈</a></div>
  ${body}
  <div class="navlinks">
    <a href="/about">사이트 소개</a><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a>
  </div>
  <footer>산업분류코드 조회 · factory.soritok.com</footer>
</div>
</body></html>`;
}

function renderAbout(site) {
  return shell(
    '사이트 소개 · 문의 | 산업분류코드 조회',
    '산업분류코드 조회 서비스 소개, 제공 데이터와 출처, 운영 방침, 문의 안내입니다.',
    `${site}/about`,
    `
<h1>사이트 소개</h1>
<div class="upd">최종 업데이트: ${UPDATED}</div>

<p>본 사이트는 대한민국의 공식 분류체계(산업·직업)를 코드 단위로 쉽게 조회할 수 있도록 만든 <b>무료 정보 서비스</b>입니다.
통계청·국세청·고용노동부·한국산업단지공단이 공개한 자료를 코드별로 통합해 제공합니다.</p>

<h2>제공 서비스</h2>
<ul>
  <li><b>산업분류코드(KSIC 11차) 조회</b> — 물품명·업종명·코드로 검색. 세세분류 1,205개, 색인어 3만여 건</li>
  <li><b>분류 해설</b> — 각 코드의 정의, 포함(예시)·제외 항목</li>
  <li><b>10차 ↔ 11차 신구연계</b> — 개정 전후 코드 변환</li>
  <li><b>국세청 업종코드·경비율</b> — 업종코드 연계 및 단순·기준경비율</li>
  <li><b>산재보험료율 / 중소기업 규모 기준</b></li>
  <li><b>직업분류</b> — 한국표준직업분류(KSCO), 한국고용직업분류(KECO)</li>
  <li><b>전국 등록공장 조회 및 업종별 통계</b></li>
</ul>

<h2>데이터 출처</h2>
<table><tbody>
<tr><th>구분</th><th>출처</th><th>기준</th></tr>
<tr><td>산업·직업 분류, 해설, 색인어, 신구연계</td><td>통계청 통계분류포털</td><td>KSIC 11차 / KSCO 8차 / KECO</td></tr>
<tr><td>업종코드·경비율</td><td>국세청</td><td>2025년 귀속</td></tr>
<tr><td>산재보험료율</td><td>고용노동부 고시</td><td>2026년도</td></tr>
<tr><td>중소기업 규모 기준</td><td>중소기업기본법 시행령 별표1·별표3</td><td>2025년 개정</td></tr>
<tr><td>등록공장 현황</td><td>한국산업단지공단(공공데이터포털)</td><td>연 1회 갱신</td></tr>
</tbody></table>

<h2>운영 방침</h2>
<div class="box">
<p><b>1. 추정하지 않습니다.</b> 화면의 모든 수치는 위 공개 자료에서 직접 유래합니다. 매출·수익처럼 원자료에 없는 값은 추정해서 표시하지 않습니다.</p>
<p><b>2. 한계를 표시합니다.</b> 근사값이거나 데이터 기준일이 지난 항목은 화면에 그 사실을 함께 표기합니다.</p>
<p><b>3. 자동 갱신합니다.</b> 통계청 분류 자료는 반기(1월·7월)마다 자동으로 재수집합니다.</p>
</div>

<h2>이용 안내</h2>
<p>본 사이트의 정보는 <b>참고용</b>입니다. 사업자등록·세무신고·인허가 등 법적 효력이 필요한 절차는 반드시 해당 기관의 공식 자료로 확인하시기 바랍니다.</p>

<h2>문의</h2>
<p>오류 제보, 데이터 수정 요청, 기타 문의는 아래로 연락 주시기 바랍니다.</p>
<div class="box">
<p><b>이메일</b> : <a href="mailto:contact@soritok.com">contact@soritok.com</a></p>
<p><b>운영</b> : 개인 운영 (비영리 정보 제공 목적, 광고 수익으로 운영비 충당)</p>
</div>
`);
}

function renderPrivacy(site) {
  return shell(
    '개인정보처리방침 | 산업분류코드 조회',
    '산업분류코드 조회 서비스의 개인정보처리방침입니다. 수집 항목, 쿠키 및 광고 정책, 이용자 권리를 안내합니다.',
    `${site}/privacy`,
    `
<h1>개인정보처리방침</h1>
<div class="upd">시행일: ${UPDATED}</div>

<p>본 사이트(이하 "사이트")는 이용자의 개인정보를 중요하게 생각하며, 관련 법령을 준수합니다.
본 방침은 사이트가 어떤 정보를 다루는지 투명하게 알리기 위한 것입니다.</p>

<h2>1. 수집하는 개인정보</h2>
<div class="box">
<p><b>사이트는 회원가입을 요구하지 않으며, 이름·연락처·주민번호 등 개인을 식별할 수 있는 정보를 직접 수집하지 않습니다.</b></p>
</div>
<p>다만 서비스 제공 및 통계 목적으로 다음 정보가 자동 생성·수집될 수 있습니다.</p>
<ul>
  <li>접속 IP 주소, 브라우저 종류 및 버전, 접속 일시</li>
  <li>방문한 페이지 주소, 유입 경로</li>
  <li>서비스 이용 기록(검색어 등 통계 목적의 비식별 정보)</li>
</ul>

<h2>2. 이용 목적</h2>
<ul>
  <li>서비스 제공 및 운영, 오류 확인</li>
  <li>이용 통계 분석을 통한 서비스 개선</li>
  <li>부정 이용 방지</li>
</ul>

<h2>3. 보유 및 파기</h2>
<p>자동 수집된 접속 기록은 서비스 운영에 필요한 기간 동안만 보관하며, 목적 달성 후 지체 없이 파기합니다.
관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>

<h2>4. 쿠키 및 광고</h2>
<p>사이트는 서비스 이용 편의와 광고 제공을 위해 쿠키(cookie)를 사용할 수 있습니다.</p>
<div class="box">
<p><b>제3자 광고</b><br>
사이트는 운영비 충당을 위해 제3자 광고 서비스를 이용할 수 있습니다. 광고 사업자는 이용자의 관심사에 맞는 광고를 제공하기 위해 쿠키 등을 사용할 수 있으며, 이 과정에서 수집되는 정보는 해당 사업자의 정책에 따릅니다.</p>
<p>· <b>쿠팡 파트너스</b> — 본 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다.<br>
· <b>Google AdSense 등</b> — Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이전 방문 기록에 기반한 광고를 게재할 수 있습니다.
Google의 광고 쿠키 사용은 <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">Google 광고 정책</a>에서 확인할 수 있으며,
<a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다.</p>
</div>
<p>이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다. 다만 이 경우 일부 기능 이용에 제한이 있을 수 있습니다.</p>

<h2>5. 제3자 제공 및 위탁</h2>
<p>사이트는 이용자의 개인정보를 제3자에게 판매하거나 제공하지 않습니다.
다만 법령에 따라 요구되는 경우에는 관련 절차에 따라 제공될 수 있습니다.</p>

<h2>6. 외부 링크</h2>
<p>사이트는 공공기관 자료 및 광고 등 외부 사이트로 연결되는 링크를 포함합니다.
링크된 사이트의 개인정보 처리에 대해서는 해당 사이트의 방침이 적용되며, 본 사이트는 이에 대해 책임지지 않습니다.</p>

<h2>7. 이용자 권리</h2>
<p>이용자는 자신의 정보에 대한 열람·정정·삭제를 요청할 수 있습니다. 문의는 아래 연락처로 주시기 바랍니다.</p>

<h2>8. 문의처</h2>
<div class="box"><p>이메일 : <a href="mailto:contact@soritok.com">contact@soritok.com</a></p></div>

<h2>9. 방침 변경</h2>
<p>본 방침이 변경되는 경우 사이트를 통해 공지하며, 변경된 방침은 게시일부터 적용됩니다.</p>
`);
}

function renderTerms(site) {
  return shell(
    '이용약관 및 면책조항 | 산업분류코드 조회',
    '산업분류코드 조회 서비스의 이용약관과 면책조항입니다. 정보의 정확성, 책임의 한계, 저작권을 안내합니다.',
    `${site}/terms`,
    `
<h1>이용약관 및 면책조항</h1>
<div class="upd">시행일: ${UPDATED}</div>

<h2>1. 서비스의 성격</h2>
<p>본 사이트는 공공기관이 공개한 분류체계 자료를 이용자가 쉽게 찾아볼 수 있도록 정리해 제공하는 <b>무료 정보 서비스</b>입니다.
공공기관의 공식 사이트가 아니며, 어떠한 기관과도 제휴·위탁 관계가 없습니다.</p>

<h2>2. 정보의 정확성과 면책</h2>
<div class="box">
<p><b>본 사이트가 제공하는 모든 정보는 참고용입니다.</b></p>
<ul>
  <li>원자료의 갱신 시점 차이, 수집·가공 과정의 오류로 실제와 다를 수 있습니다.</li>
  <li>산재보험료율 등 일부 항목은 <b>근사값</b>이며, 정확한 값은 소관 기관의 기준을 따릅니다.</li>
  <li>경비율은 세무상 추계 비율로, 실제 원가·이익률과 다릅니다.</li>
  <li>등록공장 정보는 특정 기준일의 공개 자료이며 최신 상태가 아닐 수 있습니다.</li>
</ul>
<p>사업자등록, 세무신고, 인허가, 지원사업 신청 등 <b>법적 효력이 필요한 절차는 반드시 해당 기관의 공식 자료로 확인</b>하시기 바랍니다.
본 사이트의 정보를 이용해 발생한 결과에 대해 운영자는 책임을 지지 않습니다.</p>
</div>

<h2>3. 저작권</h2>
<p>본 사이트가 제공하는 분류 자료의 원저작권은 통계청·국세청·고용노동부·한국산업단지공단 등 각 기관에 있습니다.
사이트는 공공데이터 이용 정책에 따라 해당 자료를 가공·제공합니다.</p>
<p>사이트가 직접 작성한 화면 구성·설명 문구 등에 대한 권리는 운영자에게 있습니다.</p>

<h2>4. 서비스 이용</h2>
<ul>
  <li>회원가입 없이 누구나 무료로 이용할 수 있습니다.</li>
  <li>서비스의 안정적 제공을 방해하는 과도한 자동 수집(크롤링), 시스템 부하 유발 행위는 제한될 수 있습니다.</li>
  <li>운영자는 사전 통지 없이 서비스 내용을 변경하거나 중단할 수 있습니다.</li>
</ul>

<h2>5. 광고</h2>
<p>사이트는 운영비 충당을 위해 광고를 게재합니다. 광고 상품·서비스에 대한 거래는 이용자와 해당 판매자 간에 이루어지며,
본 사이트는 그 거래에 대해 책임을 지지 않습니다.</p>
<p>본 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의 수수료를 제공받습니다.</p>

<h2>6. 문의</h2>
<div class="box"><p>이메일 : <a href="mailto:contact@soritok.com">contact@soritok.com</a></p></div>
`);
}

module.exports = { renderAbout, renderPrivacy, renderTerms };
