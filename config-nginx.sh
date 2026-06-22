#!/bin/bash
# Nginx + HTTPS 配置脚本
# 运行: bash /opt/mengli-media/config-nginx.sh

set -e

DOMAIN="media-api.mengliai.cn"

echo "🌐 配置 Nginx 反向代理..."

# 1. 创建 Nginx 配置
sudo tee /etc/nginx/sites-available/mengli-media > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:8890;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}
EOF

# 2. 启用站点
sudo ln -sf /etc/nginx/sites-available/mengli-media /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 3. 测试并重启 Nginx
sudo nginx -t && sudo systemctl restart nginx

echo "✅ Nginx 配置完成"
echo ""
echo "📋 下一步：配置 HTTPS"
echo "   确保域名 ${DOMAIN} 已解析到本服务器 IP"
echo "   然后运行: sudo certbot --nginx -d ${DOMAIN}"
echo ""
echo "⚠️ 如果域名还未解析，请先去 DNS 添加 A 记录："
echo "   ${DOMAIN} → $(curl -s ifconfig.me)"
