#!/usr/bin/env bash
# gomHomework 서버 — pm2 프로덕션 실행
# 사용법: ./start.sh [stop|restart|status|log]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="gom-homework"

case "${1:-}" in
  stop)
    pm2 stop "$APP_NAME" && echo "서버 중지됨"
    exit 0
    ;;
  restart)
    pm2 restart "$APP_NAME" && echo "서버 재시작됨"
    exit 0
    ;;
  status)
    pm2 show "$APP_NAME"
    exit 0
    ;;
  log)
    pm2 logs "$APP_NAME"
    exit 0
    ;;
esac

# ── 의존성 확인 ──────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "📦 npm install 실행 중..."
  npm install
fi

# ── .env 확인 ────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "⚠️  .env 없음 → .env.example 복사"
  cp .env.example .env
  echo "   server/.env 를 열어서 설정을 확인하세요."
  echo "   (PORT, DB_PATH, ADMIN_SECRET 등)"
  exit 1
fi

# ── pm2 시작 ─────────────────────────────────────
if pm2 show "$APP_NAME" &>/dev/null; then
  echo "🔄 이미 실행 중 → 재시작"
  pm2 restart "$APP_NAME"
else
  echo "🚀 서버 시작..."
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo ""
echo "✅ 완료. 명령어:"
echo "   ./start.sh status   — 상태 확인"
echo "   ./start.sh log      — 로그 보기"
echo "   ./start.sh restart  — 재시작"
echo "   ./start.sh stop     — 중지"
