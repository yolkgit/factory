#!/bin/sh
# 반기 자동 데이터 업데이트: 통계청 산업분류 자료(트리·색인어·신구연계·해설) 재수집 → 검증 → 반영.
# 호스트에 node가 없어 node 컨테이너에서 크롤/빌드를 실행한다. 실패 시 기존 데이터 유지.
# 참고: 경비율·산재요율·중소기업 기준은 법령/기관 파일 기반 상수라 자동 갱신 대상이 아님(연 1회 수동 점검).
set -eu
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")"

LOG="update.log"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $1" | tee -a "$LOG"; }

log "=== 자동 업데이트 시작 ==="

# 1) 기존 데이터 백업
rm -rf data.bak
cp -r data data.bak
cp public/ksic-data.json public/ksic-data.json.bak

# 2) node 컨테이너에서 크롤 + 빌드 (파일 소유권을 호스트 사용자로 유지)
UID_GID="$(id -u):$(id -g)"
if docker run --rm -u "$UID_GID" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
     -v "$PWD":/app -w /app node:22-alpine \
     sh -c "npm ci --no-audit --no-fund --loglevel=error && npm run crawl && npm run build-all" \
     >> "$LOG" 2>&1; then
  # build-data.js가 검증 통과 시에만 ksic-data.json을 갱신(비정상이면 exit 1 → 아래 else)
  log "크롤·빌드 성공 → 컨테이너 재빌드"
  if docker compose up -d --build >> "$LOG" 2>&1; then
    rm -rf data.bak public/ksic-data.json.bak
    log "=== 업데이트 완료 ==="
  else
    log "컨테이너 재기동 실패 → 데이터 백업 복원"
    rm -rf data; mv data.bak data
    mv public/ksic-data.json.bak public/ksic-data.json
    docker compose up -d --build >> "$LOG" 2>&1 || true
    exit 1
  fi
else
  log "크롤/빌드/검증 실패 → 데이터 백업 복원(서비스 영향 없음)"
  rm -rf data; mv data.bak data
  mv public/ksic-data.json.bak public/ksic-data.json
  exit 1
fi
