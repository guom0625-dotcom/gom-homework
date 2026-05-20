#!/usr/bin/env bash
# gomHomework 서버 — tsx watch 개발 모드 (코드 변경 시 자동 재시작)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 npm install 실행 중..."
  npm install
fi

if [ ! -f ".env" ]; then
  echo "⚠️  .env 없음 → .env.example 복사"
  cp .env.example .env
fi

echo "🛠️  개발 모드로 서버 시작 (Ctrl+C 로 종료)"
echo ""
npm run dev
