// 페이지 모듈 간 의존성 주입을 한곳에 모은다.
//
// 각 페이지 모듈(jobpage/kecopage/upjongpage)은 codepage의 헤더·사이드바·광고·노드조회를
// 주입받아야 완전한 HTML을 만든다. 이 주입이 server.js에만 있었더니, 같은 모듈을 쓰는
// scripts/indexnow.js는 주입 없이 렌더하게 되어 본문이 짧아졌고,
// 렌더 길이로 판정하는 SITEMAP_CODES가 두 경로에서 서로 다른 목록을 냈다(250개 차이).
// 주입 지점을 하나로 두어 어느 진입점에서 부르든 같은 결과가 나오게 한다.
function wireAll() {
  const codepage = require('./codepage');
  const jobpage = require('./jobpage');
  const kecopage = require('./kecopage');
  const upjongpage = require('./upjongpage');

  jobpage.setAdSlot(codepage.adSlotHtml);
  jobpage.setSidebars(codepage.sidebarsHtml, codepage.SIDEBAR_CSS);
  jobpage.setHeader(codepage.headerNavHtml, codepage.HEADER_CSS);

  kecopage.setDeps(codepage.adSlotHtml, codepage.SIDEBAR_CSS);
  kecopage.setHeader(codepage.headerNavHtml, codepage.HEADER_CSS);

  upjongpage.setDeps(codepage.getNode, codepage.adSlotHtml, codepage.SIDEBAR_CSS);
  upjongpage.setHeader(codepage.headerNavHtml, codepage.HEADER_CSS);

  require('./sitepages').setHeader(codepage.headerNavHtml, codepage.HEADER_CSS);

  return { codepage, jobpage, kecopage, upjongpage };
}

module.exports = { wireAll };
