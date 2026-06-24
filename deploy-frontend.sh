#!/bin/bash
# 萌力互动 · 前端部署到腾讯云
# 运行: sudo bash deploy-frontend.sh

set -e

DOMAIN="www.mengliai.cn"
WEB_DIR="/var/www/mengli"

echo "🚀 部署前端到腾讯云"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 创建网站目录
echo "📁 创建网站目录..."
mkdir -p $WEB_DIR
cd $WEB_DIR
tar xzf /tmp/mengli-frontend.tar.gz

# 2. 设置权限
chown -R www-data:www-data $WEB_DIR
chmod -R 755 $WEB_DIR

# 3. 配置 Nginx
echo "🌐 配置 Nginx..."
cat > /etc/nginx/sites-available/mengli-web << EOF
server {
    listen 80;
    server_name ${DOMAIN} mengliai.cn;

    root ${WEB_DIR};
    index index.html;

    # 前端静态文件
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API 代理（认证、历史、素材等）
    location /auth/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /history {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /assets {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /brands {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /templates {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /preferences {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /feedback {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /permissions/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /plugin-feedback {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /plugins {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /upload/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host \$host;
        client_max_body_size 50m;
    }

    location /uploads/ {
        alias /opt/mengli-api/uploads/;
        expires 30d;
    }

    # AI API 代理（文案、图片等）
    location /api {
        proxy_pass http://127.0.0.1:8890;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}
EOF

# 4. 启用站点
ln -sf /etc/nginx/sites-available/mengli-web /etc/nginx/sites-enabled/

# 5. 测试并重启
nginx -t && systemctl restart nginx

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 前端部署完成"
echo ""
echo "📍 访问: http://${DOMAIN}"
echo "📍 API:  http://api.mengliai.cn"
echo ""
echo "📋 下一步: 配置 HTTPS"
echo "   sudo certbot --nginx -d ${DOMAIN} -d mengliai.cn"
