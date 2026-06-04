#!/bin/bash
# 萌力互动 · 创作者工作台 启动脚本
# 用法: bash ~/Desktop/creator-workbench/start.sh

cd "$(dirname "$0")"

echo "🚀 萌力互动 · 创作者工作台"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 Python 包
python3 -c "import fastapi, uvicorn, yaml, requests" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 安装依赖..."
    pip3 install fastapi uvicorn pyyaml requests --quiet
fi

echo "📍 地址: http://localhost:8890"
echo "📋 模块: 达人找号 | 文案撰写 | 图片生成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

python3 server.py
