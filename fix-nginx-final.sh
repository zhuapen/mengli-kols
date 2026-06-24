#!/bin/bash
# 最终 Nginx 修复 — 精确匹配 API 路径，不匹配文件名

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

    # API 路由 — 精确匹配路径段（不匹配文件名如 auth.js）
    location /auth/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /history {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /assets {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /brands {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /templates {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /preferences {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /feedback {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /permissions/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /plugins {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /plugin-feedback {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /upload/ {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50m;
    }

    location /uploads/ {
        alias /opt/mengli-api/uploads/;
        expires 30d;
    }

    location /health {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /backup {
        proxy_pass http://127.0.0.1:8891;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # AI API — /api 路径
    location /api {
        proxy_pass http://127.0.0.1:8891;
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

nginx -t && systemctl restart nginx && echo "✅ Nginx 修复完成"
