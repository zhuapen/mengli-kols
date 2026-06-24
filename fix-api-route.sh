#!/bin/bash
# 修复 API 路由 — AI 生成走 Vercel，媒体库走本地

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

    # 认证和业务 API → 本地 api-server.py (8891)
    location ~ ^/(auth|admin|history|assets|brands|templates|preferences|feedback|permissions|plugins|plugin-feedback|upload|uploads|health|backup) {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # AI 生成 API → Vercel (文案/图片/写稿)
    location /api {
        proxy_pass https://www.mengliai.cn.vercel.app;
        proxy_set_header Host www.mengliai.cn.vercel.app;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        proxy_ssl_server_name on;
    }

    # 智能媒体库 API → 本地 server.py (8890)
    location ~ ^/(media-api|collector|codex-tasks|database|recommendations|candidates) {
        proxy_pass http://127.0.0.1:8890;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

nginx -t && systemctl restart nginx && echo "✅ API 路由修复完成"
