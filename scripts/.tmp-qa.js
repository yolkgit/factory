// 임시: 수집한 ksco-desc.json의 품질을 점검한다(파싱 잔해·중복·빈 값).
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('data/ksco-desc.json', 'utf8'));
const vals = Object.entries(d);

const bad = {
  '주석잔해(-->)': vals.filter(([, v]) => /-->/.test(v.d || '')),
  '태그잔해(<)': vals.filter(([, v]) => /<[a-zA-Z/!]/.test(v.d || '')),
  '엔티티잔해(&)': vals.filter(([, v]) => /&(nbsp|lt|gt|amp|#)/.test(v.d || '')),
  '설명없음': vals.filter(([, v]) => !v.d),
  '영문명없음': vals.filter(([, v]) => !v.e),
};
for (const [k, arr] of Object.entries(bad)) {
  console.log(`${k}: ${arr.length}${arr.length ? '  예) ' + arr.slice(0, 2).map(([c]) => c).join(', ') : ''}`);
}

// 같은 줄이 연속 중복되는 경우(이전 버그 흔적)
const dup = vals.filter(([, v]) => {
  const lines = (v.d || '').split('\n').filter(Boolean);
  return lines.length !== new Set(lines).size;
});
console.log(`줄 중복 있는 코드: ${dup.length}${dup.length ? '  예) ' + dup.slice(0, 3).map(([c]) => c).join(', ') : ''}`);

const lens = vals.map(([, v]) => (v.d || '').length).sort((a, b) => a - b);
console.log(`설명 길이 — 중앙값 ${lens[Math.floor(lens.length / 2)]}자 · 최소 ${lens[0]} · 최대 ${lens[lens.length - 1]}`);
console.log(`구분자 포함 비율: ${Math.round(100 * vals.filter(([, v]) => /\[/.test(v.d || '')).length / vals.length)}%`);
