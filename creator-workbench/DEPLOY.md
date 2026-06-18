# 智能媒体库 — 部署文档

## 架构

```
Vercel (www.mengliai.cn)              Railway (media-api.mengliai.cn)
┌─────────────────────┐              ┌─────────────────────────┐
│ 前端 index.html      │   fetch     │ FastAPI (server.py)      │
│ find-page.js         │ ─────────→  │ SQLite / PostgreSQL      │
│ MEDIA_API_BASE 配置   │  跨域 HTTPS │ Playwright 爬虫（本地）    │
└─────────────────────┘              └─────────────────────────┘
```

---

## Railway 部署（推荐）

### 部署步骤

1. **Fork 或连接仓库**
   - 登录 [Railway](https://railway.app)
   - New Project → Deploy from GitHub repo
   - 选择 `mengli-kols` 仓库，分支 `feature/media-library`
   - Root Directory 设置为 `creator-workbench`

2. **配置环境变量**
   在 Railway Dashboard → Variables 中添加：

   | 变量 | 值 | 说明 |
   |---|---|---|
   | `MENGLI_PUBLIC_URL` | `https://media-api.mengliai.cn` | 服务公网地址 |
   | `DATABASE_URL` | 留空 | 留空=SQLite，设为 PG 连接串则走 PostgreSQL |

3. **部署**
   - Railway 自动检测 Dockerfile 并构建
   - 部署完成后获得公网域名

4. **配置自定义域名**
   - Railway Dashboard → Settings → Domains
   - 添加 `media-api.mengliai.cn`
   - 在 DNS 添加 CNAME 记录指向 Railway 提供的地址

5. **验证**
   ```bash
   curl https://media-api.mengliai.cn/api/health
   # 返回: {"status": "ok", "version": "1.0.0"}
   ```

### 环境变量清单

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `PORT` | 否 | 8890 | Railway 自动注入 |
| `MENGLI_HOST` | 否 | 0.0.0.0 | 监听地址 |
| `MENGLI_PORT` | 否 | 8890 | 监听端口（Railway 用 $PORT） |
| `MENGLI_PUBLIC_URL` | 是 | 空 | 服务公网地址，用于采集脚本回调 |
| `DATABASE_URL` | 否 | 空 | PostgreSQL 连接串，留空用 SQLite |

### 启动命令

```
uvicorn server:app --host 0.0.0.0 --port $PORT
```

### 健康检查

```
GET https://media-api.mengliai.cn/api/health
→ {"status": "ok", "version": "1.0.0"}
```

---

## ⚠️ 风险说明

### SQLite 持久化

**Railway 使用 ephemeral 文件系统，每次部署/重启会丢失 SQLite 数据。**

解决方案（按优先级）：

1. **使用 Railway Volume**（推荐）
   - Railway Dashboard → Settings → Add Volume
   - 挂载路径：`/app/data`
   - 数据持久化，重启不丢失

2. **迁移到 Supabase PostgreSQL**
   - 设置 `DATABASE_URL=postgresql://...`
   - 修改 `server.py` 的 `db()` 函数启用 PG 连接
   - 数据永不丢失，支持并发

3. **定期导出备份**
   - 使用 `POST /api/backup` 手动备份
   - 使用 `GET /api/projects/{id}/export` 导出 Excel

### Playwright 爬虫

Playwright 爬虫（`run-pgy-task.mjs`）是 Node.js 脚本，**不能在 Railway 的 Python 容器中运行**。

解决方案：
- **本地运行**：在本地电脑执行 `node run-pgy-task.mjs <task_id>`
- **单独部署**：在 Railway 创建第二个 Node.js 服务专门跑爬虫
- **定时任务**：使用 GitHub Actions 或 cron 定时触发

### 回滚方案

1. Railway Dashboard → Deployments → 选择历史版本 → Redeploy
2. 或在本地 `git revert` 后 push 触发重新部署

---

## 自有服务器部署（备选）

### 快速部署

```bash
# 上传代码
scp -r creator-workbench/ user@server:/opt/mengli-media/

# 安装依赖
cd /opt/mengli-media
pip3 install -r requirements.txt

# 配置环境变量
cp .env.example .env
vim .env  # 修改 MENGLI_PUBLIC_URL

# 启动
python3 server.py
# 或
uvicorn server:app --host 0.0.0.0 --port 8890
```

### systemd 守护

```bash
cp mengli-media.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable mengli-media
systemctl start mengli-media
```

### Nginx + HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name media-api.mengliai.cn;

    ssl_certificate /etc/letsencrypt/live/media-api.mengliai.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media-api.mengliai.cn/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8890;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }
}
```

---

## 数据备份

- **自动备份**：启动时 + 每小时自动备份到 `backups/` 目录
- **手动备份**：`POST /api/backup`
- **保留策略**：最近 30 个备份，自动清理旧的

### 恢复

```bash
# 停止服务
systemctl stop mengli-media

# 恢复
cp backups/mengli_20240101_120000.sqlite3 data/mengli_creator_selection.sqlite3

# 启动
systemctl start mengli-media
```

---

## 前端配置

修改 `find-page.js` 第 7 行：

```javascript
const MEDIA_API_BASE = 'https://media-api.mengliai.cn';
```

---

## API 端点

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
