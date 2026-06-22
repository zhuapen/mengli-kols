#!/bin/bash
# 萌力互动 · 智能媒体库 — 服务器一键部署脚本
# 在腾讯云服务器上运行：bash deploy-server.sh

set -e

echo "🚀 萌力互动 · 智能媒体库部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 安装依赖
echo "📦 安装系统依赖..."
sudo apt update -qq
sudo apt install -y -qq python3-pip python3-venv nginx certbot python3-certbot-nginx

echo "📦 安装 Python 依赖..."
pip3 install fastapi uvicorn openpyxl pydantic

# 2. 创建目录
echo "📁 创建部署目录..."
sudo mkdir -p /opt/mengli-media
sudo chown -R ubuntu:ubuntu /opt/mengli-media

# 3. 解压代码（需要先上传 mengli-media.tar.gz 到 /tmp/）
echo "📂 解压代码..."
cd /opt/mengli-media
tar xzf /tmp/mengli-media.tar.gz --strip-components=1

# 4. 创建数据目录
mkdir -p data exports backups

# 5. 配置环境变量
cat > /opt/mengli-media/.env << 'EOF'
MENGLI_HOST=0.0.0.0
MENGLI_PORT=8890
MENGLI_PUBLIC_URL=https://media-api.mengliai.cn
DATABASE_URL=
EOF

# 6. 创建 systemd 服务
echo "⚙️ 配置 systemd 服务..."
sudo tee /etc/systemd/system/mengli-media.service > /dev/null << 'EOF'
[Unit]
Description=萌力互动智能媒体库
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/mengli-media
EnvironmentFile=/opt/mengli-media/.env
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8890
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 7. 启动服务
echo "🔄 启动服务..."
sudo systemctl daemon-reload
sudo systemctl enable mengli-media
sudo systemctl start mengli-media

# 8. 等待启动
sleep 2

# 9. 检查状态
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
if systemctl is-active --quiet mengli-media; then
    echo "✅ 服务启动成功"
    echo ""
    echo "📍 本地地址: http://localhost:8890"
    echo "📍 健康检查: curl http://localhost:8890/api/health"
    echo ""
    echo "🔧 服务管理命令："
    echo "   sudo systemctl status mengli-media   # 查看状态"
    echo "   sudo systemctl restart mengli-media   # 重启"
    echo "   sudo journalctl -u mengli-media -f    # 查看日志"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 下一步：配置 Nginx 和 HTTPS"
    echo "   运行: bash /opt/mengli-media/config-nginx.sh"
else
    echo "❌ 服务启动失败，查看日志："
    echo "   sudo journalctl -u mengli-media -n 20"
fi
