#!/bin/bash
# 优化 Nginx — gzip + 缓存 + 清理

# 1. 清理 macOS 元数据文件
rm -f /var/www/mengli/._*

# 2. 启用完整 gzip
sed -i 's/# gzip_vary on;/gzip_vary on;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_proxied any;/gzip_proxied any;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_comp_level 6;/gzip_comp_level 6;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_buffers 16 8k;/gzip_buffers 16 8k;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_http_version 1.1;/gzip_http_version 1.1;/' /etc/nginx/nginx.conf
sed -i 's/# gzip_types text\/plain/gzip_types text\/plain/' /etc/nginx/nginx.conf

# 3. 测试并重启
nginx -t && systemctl restart nginx

echo "✅ Nginx 优化完成"
echo ""
echo "测试加载速度："
curl -s -o /dev/null -w "HTTP %{http_code} | 大小: %{size_download} bytes | 时间: %{time_total}s\n" https://www.mengliai.cn/
