# ksic-search

한국표준산업분류(KSIC) 11차 코드 검색 웹앱.
제조 물품·업종명을 입력하면 알맞은 산업분류코드(세세분류 5자리)와 비슷한 항목을 함께 보여준다.

- 데이터 출처: 통계청 통계분류포털(kssc.kostat.go.kr)
  - 분류 계층 트리(대~세세분류 2,038개 항목)
  - 색인어 약 3만 건 (물품·활동명 → 5자리 코드 매핑)
- 검색은 전부 브라우저(클라이언트)에서 수행 — 서버는 정적 파일만 제공

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
