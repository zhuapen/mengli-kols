#!/bin/bash
# 修复 Nginx 配置 — API 路由优先于前端

DOMAIN="www.mengliai.cn"
WEB_DIR="/var/www/mengli"

cat > /etc/nginx/sites-available/mengli-web << 'NGINX'
server {
    listen 80;
    server_name www.mengliai.cn mengliai.cn;
    return 301 https://www.mengliai.cn$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.mengliai.cn mengliai.cn;

    ssl_certificate /etc/letsencrypt/live/www.mengliai.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.mengliai.cn/privkey.pem;

    root /var/www/mengli;
    index index.html;
    client_max_body_size 50m;

    # API 路由优先（认证、业务、健康检查）
    location ~ ^/(auth|admin|history|assets|brands|templates|preferences|feedback|permissions|plugins|plugin-feedback|upload|uploads|health|backup) {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # AI API 代理（文案、图片等）
    location /api {
        proxy_pass http://127.0.0.1:8890;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }

    # 前端静态文件（最后匹配）
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

nginx -t && systemctl restart nginx && echo "✅ Nginx 配置修复完成"
