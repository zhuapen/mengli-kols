#!/bin/bash
# 萌力互动 · 全量部署脚本
# 在腾讯云服务器上运行：sudo bash deploy-full.sh

set -e

echo "🚀 萌力互动 · 全量部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 安装 PostgreSQL
echo "📦 安装 PostgreSQL..."
apt update -qq
apt install -y -qq postgresql postgresql-contrib python3-pip nginx certbot python3-certbot-nginx

# 2. 安装 Python 依赖
echo "📦 安装 Python 依赖..."
pip3 install fastapi uvicorn openpyxl pydantic psycopg2-binary python-multipart

# 3. 配置 PostgreSQL
echo "🗄️ 配置 PostgreSQL..."
sudo -u postgres psql -c "CREATE USER mengli WITH PASSWORD 'mengli2024';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE mengli_db OWNER mengli;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mengli_db TO mengli;" 2>/dev/null || true

# 4. 初始化数据库表
echo "📋 创建数据库表..."
sudo -u postgres psql -d mengli_db -f /tmp/init-database.sql

# 5. 部署 API 服务器
echo "🔧 部署 API 服务器..."
mkdir -p /opt/mengli-api
cp /tmp/api-server.py /opt/mengli-api/server.py

# 6. 创建环境变量
cat > /opt/mengli-api/.env << 'EOF'
DATABASE_URL=postgresql://mengli:mengli2024@localhost:5432/mengli_db
MENGLI_HOST=0.0.0.0
MENGLI_PORT=8891
EOF

# 7. 创建 systemd 服务
cat > /etc/systemd/system/mengli-api.service << 'EOF'
[Unit]
Description=萌力互动 API 服务器
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mengli-api
EnvironmentFile=/opt/mengli-api/.env
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8891
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 8. 启动服务
echo "🔄 启动 API 服务..."
systemctl daemon-reload
systemctl enable mengli-api
systemctl start mengli-api

# 9. 配置 Nginx
echo "🌐 配置 Nginx..."
cat > /etc/nginx/sites-available/mengli-api << 'NGINX'
server {
    listen 80;
    server_name api.mengliai.cn;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }

    location /uploads/ {
        alias /opt/mengli-api/uploads/;
        expires 30d;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mengli-api /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 10. 等待启动
sleep 3

# 11. 验证
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s http://localhost:8891/health | grep -q "ok"; then
    echo "✅ API 服务启动成功"
    echo ""
    echo "📍 健康检查: curl http://localhost:8891/health"
    echo "📍 默认管理员: admin@mengliai.cn / admin123"
    echo ""
    echo "🔧 服务管理："
    echo "   sudo systemctl status mengli-api"
    echo "   sudo journalctl -u mengli-api -f"
    echo ""
    echo "📋 下一步："
    echo "   1. DNS 解析: api.mengliai.cn → $(curl -s ifconfig.me)"
    echo "   2. HTTPS: sudo certbot --nginx -d api.mengliai.cn"
else
    echo "❌ 服务启动失败"
    echo "   查看日志: sudo journalctl -u mengli-api -n 30"
fi
