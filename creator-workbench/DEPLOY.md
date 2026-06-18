# 智能媒体库 — 部署文档

## 架构

```
Vercel (www.mengliai.cn)              自有服务器 (media-api.mengliai.cn)
┌─────────────────────┐              ┌─────────────────────────┐
│ 前端 index.html      │   fetch     │ FastAPI (server.py)      │
│ find-page.js         │ ─────────→  │ SQLite 数据库             │
│ MEDIA_API_BASE 配置   │  跨域 HTTPS │ Playwright 爬虫           │
└─────────────────────┘              └─────────────────────────┘
```

## 服务器要求

- Python 3.9+
- 2GB+ RAM（Playwright 需要 Chromium）
- 10GB+ 磁盘
- Ubuntu 20.04+ / CentOS 7+ / Debian 10+

## 快速部署

### 1. 上传代码

```bash
scp -r creator-workbench/ user@your-server:/opt/mengli-media/
```

### 2. 安装依赖

```bash
cd /opt/mengli-media
pip3 install fastapi uvicorn openpyxl
# Playwright（可选，用于蒲公英爬虫）
pip3 install playwright
playwright install chromium
```

### 3. 配置环境变量

```bash
cat > .env << 'EOF'
MENGLI_HOST=0.0.0.0
MENGLI_PORT=8890
MENGLI_PUBLIC_URL=https://media-api.mengliai.cn
DATABASE_URL=
EOF
```

### 4. 启动服务

```bash
# 方式一：直接启动
python3 server.py

# 方式二：使用 systemd 守护（推荐）
sudo cp mengli-media.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mengli-media
sudo systemctl start mengli-media
```

### 5. systemd 服务文件

创建 `/etc/systemd/system/mengli-media.service`：

```ini
[Unit]
Description=萌力互动智能媒体库
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mengli-media
EnvironmentFile=/opt/mengli-media/.env
ExecStart=/usr/bin/python3 server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 6. Nginx 反向代理 + HTTPS

```nginx
server {
    listen 80;
    server_name media-api.mengliai.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name media-api.mengliai.cn;

    ssl_certificate /etc/letsencrypt/live/media-api.mengliai.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media-api.mengliai.cn/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8890;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}
```

### 7. Let's Encrypt 证书

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d media-api.mengliai.cn
```

## 前端配置

修改 `find-page.js` 第 7 行：

```javascript
const MEDIA_API_BASE = 'https://media-api.mengliai.cn';
```

然后部署到 Vercel。

## 健康检查

```bash
curl https://media-api.mengliai.cn/api/health
# 返回: {"status": "ok", "version": "1.0.0"}
```

## 数据备份

- **自动备份**：启动时 + 每小时自动备份到 `backups/` 目录
- **手动备份**：`POST /api/backup`
- **备份路径**：`/opt/mengli-media/backups/mengli_YYYYMMDD_HHMMSS.sqlite3`
- **保留策略**：最近 30 个备份，自动清理旧的

### 恢复备份

```bash
# 停止服务
sudo systemctl stop mengli-media

# 恢复
cp /opt/mengli-media/backups/mengli_20240101_120000.sqlite3 \
   /opt/mengli-media/data/mengli_creator_selection.sqlite3

# 启动
sudo systemctl start mengli-media
```

## 迁移 PostgreSQL

当数据量或并发上来后：

1. 设置环境变量：`DATABASE_URL=postgresql://user:pass@host:5432/dbname`
2. 安装：`pip3 install psycopg2-binary`
3. 修改 `server.py` 的 `db()` 函数，启用 PG 连接
4. 导入数据：使用 SQLite → PostgreSQL 迁移工具
5. SQL 方言调整：`AUTOINCREMENT` → `SERIAL`，`?` → `%s`

## API 端点一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/backup` | 手动备份 |
| POST | `/api` | Brief 拆解（action: brief_analysis） |
| GET/POST | `/api/projects` | 项目 CRUD |
| POST | `/api/projects/{id}/codex-find/start` | 启动采集 |
| GET | `/api/projects/{id}/candidates` | 候选人列表 |
| GET | `/api/projects/{id}/recommendations` | 推荐列表 |
| POST | `/api/projects/{id}/recommendations/auto` | 自动推荐 |
| GET | `/api/projects/{id}/export` | Excel 导出 |
| POST | `/api/collector/ingest` | 采集数据入库 |
| GET | `/api/database/creators` | 媒体库数据 |
| POST | `/api/projects/{id}/feedback` | 保存反馈 |
