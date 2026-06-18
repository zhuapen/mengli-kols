#!/bin/bash
# 萌力互动 · 智能媒体库 启动脚本
# 环境变量：
#   MENGLI_HOST       监听地址，默认 0.0.0.0
#   MENGLI_PORT       监听端口，默认 8890（Railway 用 $PORT）
#   MENGLI_PUBLIC_URL 公网地址，如 https://media-api.mengliai.cn

cd "$(dirname "$0")"

echo "🚀 萌力互动 · 智能媒体库"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 Python 包
python3 -c "import fastapi, uvicorn" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 安装依赖..."
    pip3 install -r requirements.txt --quiet
fi

# Railway 使用 $PORT，优先级：$PORT > $MENGLI_PORT > 8890
PORT=${PORT:-${MENGLI_PORT:-8890}}
HOST=${MENGLI_HOST:-0.0.0.0}

echo "📍 地址: http://${HOST}:${PORT}"
if [ -n "$MENGLI_PUBLIC_URL" ]; then
    echo "🌐 公网: $MENGLI_PUBLIC_URL"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec uvicorn server:app --host "$HOST" --port "$PORT"
