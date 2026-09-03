// 사이트맵·IndexNow에 제출할 페이지를 실제 렌더링 결과의 본문 분량으로 고른다.
//
// 왜 필요한가: 6,294개를 전량 제출했더니 구글이 223개만 색인하고 4,494개를
// "크롤링됨/발견됨 - 색인 안 됨"으로 처리했다. 목록·이름만 있는 얇은 페이지가 절반이라
// 사이트 전체 평가가 내려간 것으로 본다. 사이트맵은 "내 중요한 페이지" 목록이므로
// 내용이 있는 것만 제출한다. 페이지 자체는 지우지도 noindex 하지도 않으며,
// 이용자와 크롤러 모두 링크로 그대로 접근할 수 있다.
//
// 기준을 코드 유무·자식 수 같은 대리지표로 잡아봤더니 실제 분량과 어긋났다
// (해설이 있어도 110자면 페이지는 여전히 얇다). 그래서 렌더링해서 직접 잰다.
// 전체 6,287쪽 렌더가 1.8초라 첫 호출에 계산하고 캐시하면 충분하다.

const MIN_BODY_CHARS = 600;

// class="NAME"인 div를 여는/닫는 태그 깊이를 세어 통째로 제거한다.
// 중첩 div가 있어 정규식 하나로는 정확히 잘리지 않는다.
function stripBlock(html, name) {
  const open = `<div class="${name}"`;
  let out = html;
  for (;;) {
    const start = out.indexOf(open);
    if (start === -1) return out;
    let i = start, depth = 0;
    const tag = /<\/?div\b/g;
    tag.lastIndex = start;
    let m;
    while ((m = tag.exec(out)) !== null) {
      depth += m[0][1] === '/' ? -1 : 1;
      if (depth === 0) { i = m.index + m[0].length; break; }
    }
    if (depth !== 0) return out; // 짝이 안 맞으면 건드리지 않는다
    const close = out.indexOf('>', i);
    out = out.slice(0, start) + out.slice(close === -1 ? i : close + 1);
  }
}

// 헤더·사이드바·푸터를 뺀 본문(.wrap 안, footer 앞)의 글자 수.
// 광고 슬롯은 제외한다 — 광고와 법정 고지문(219자)은 페이지의 내용이 아닌데
// 포함해서 재면 실질 400자짜리가 619자로 기준을 통과해 판정이 헐거워진다.
// 또 광고는 주입되는 값이라, 포함하면 서버(주입 있음)와 indexnow 스크립트(주입 없음)가
// 서로 다른 목록을 만들어낸다(실제로 250개가 어긋났다).
function bodyLength(html) {
  if (!html) return 0;
  const m = html.match(/<div class="wrap">([\s\S]*?)<footer/);
  if (!m) return 0;
  return stripBlock(m[1], 'ad-slot')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

// 모듈별로 한 번만 계산해 재사용한다. 데이터는 배포 때만 바뀌므로 프로세스 수명 동안 유효하다.
function memoize(fn) {
  let cached = null;
  return () => (cached || (cached = fn()));
}

// codes 중 본문이 MIN_BODY_CHARS 이상인 것만 남긴다.
// render가 던지거나 null을 주면 제외한다(존재하지 않는 코드 등).
function filterByBody(codes, render) {
  const out = [];
  for (const c of codes) {
    let len = 0;
    try { len = bodyLength(render(c)); } catch (e) { len = 0; }
    if (len >= MIN_BODY_CHARS) out.push(c);
  }
  return out;
}

module.exports = { MIN_BODY_CHARS, bodyLength, filterByBody, memoize };
