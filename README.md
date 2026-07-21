# ksic-search

한국표준산업분류(KSIC) 11차 코드 검색 웹앱.
제조 물품·업종명을 입력하면 알맞은 산업분류코드(세세분류 5자리)와 비슷한 항목을 함께 보여준다.

- 데이터 출처
  - 통계청 통계분류포털(kssc.kostat.go.kr): 분류 계층 트리 2,038개 항목, 색인어 약 3만 건, 10차↔11차 신구연계표, 세세분류 해설(정의·예시·제외) 1,205개
  - 국세청 홈택스: 업종코드-11차 표준산업분류 연계표(`data/upjong-ksic.xlsx` → `npm run build-upjong`)
  - 중소기업기본법 시행령 별표1(2025.10.1 개정)·별표3(2025.9.1 개정): 업종별 중소기업/소기업 평균매출액 기준
    (원본 PDF: `data/byl1-sme.pdf`, `data/byl3-small.pdf` — 기준표는 `public/index.html`의 SME_* 상수에 하드코딩,
    법령 개정 시 별표 PDF 재확인 후 갱신 필요)
- 검색은 전부 브라우저(클라이언트)에서 수행 — 서버는 정적 파일만 제공
- 검색 지원: 물품·업종명, 해설 본문, KSIC 코드(11차), 구 10차 코드 변환, 국세청 업종코드(6자리) 변환
- 각 세세분류 카드에 공식 해설(정의·포함 예시·제외 항목) 표시, 제외 코드는 클릭 시 해당 코드로 이동

## 실행

```bash
npm install
npm start        # http://localhost:3000
```

## 데이터 갱신 (분류 개정 시)

```bash
npm run crawl        # 통계청 사이트에서 트리 + 색인어 재수집 → data/
npm run build-data   # data/ → public/ksic-data.json 병합
```

## 배포

```bash
docker compose up -d --build   # 호스트 포트 3005
```
