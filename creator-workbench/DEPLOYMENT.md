# 智能媒体库部署说明

## Railway / Web 服务

Railway 或你的云服务器只建议承载网页、FastAPI 后端、数据库接口和任务队列；不要直接跑蒲公英采集 worker。采集 worker 放在你自己的电脑上，复用本机 Chrome 登录态采集蒲公英，再把结果回传服务器。

推荐环境变量：

```bash
BRIEF_MODEL_PROVIDER=deepseek   # codex | deepseek | kimi | openai-compatible
BRIEF_MODEL_NAME=
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL_NAME=deepseek-chat
DEEPSEEK_API_BASE=https://api.deepseek.com
KIMI_API_KEY=
KIMI_MODEL_NAME=kimi-latest
KIMI_API_BASE=https://api.moonshot.cn/v1
BRIEF_COMPAT_API_KEY=
BRIEF_COMPAT_MODEL_NAME=
BRIEF_COMPAT_API_BASE=
BRIEF_COMPAT_PROVIDER_NAME=openai-compatible
MENGLI_COLLECTOR_WORKER_ENABLED=0
SUPABASE_URL=https://fjlxlkokmcdfmwskgvsp.supabase.co
SUPABASE_ANON_KEY=...
```

如果前端是独立主站，需要把主站里的 `MEDIA_API_BASE` 指向 Railway / 云服务器上的智能媒体库 FastAPI 服务地址。不要填到 `/api` 结尾，推荐填服务根地址，例如：

```html
<script>
  window.MEDIA_API_BASE = "https://你的媒体库后端域名";
</script>
```

临时联调也可以在浏览器控制台设置，刷新页面后生效：

```js
localStorage.setItem("mengli_media_api_base", "https://你的媒体库后端域名")
```

如果不配置，页面会默认请求当前主站的 `/api/health`。当主站 API 和媒体库 FastAPI 不是同一个服务时，点击“开始找号”会无法创建采集任务，结果页也不会有真实推荐。

## 本机采集 worker

采集节点需要 Chrome 登录态和 Playwright。当前方案是 worker 放在你的电脑上，不上服务器；网页上的“开始找号”会在服务器创建 queued 任务，你电脑上的 worker 自动领取任务、打开已登录 Chrome 采集蒲公英并回传。

```bash
BRIEF_MODEL_PROVIDER=codex
CODEX_EXECUTABLE=codex
MENGLI_COLLECTOR_WORKER_ENABLED=1
MENGLI_SERVER=https://你的服务器域名
```

启动 worker：

```bash
cd /path/to/mengli-kols
MENGLI_SERVER=https://你的媒体库后端域名 node creator-workbench/scripts/pgy-worker.mjs
```

worker 会轮询服务器上的 queued 找号任务，认领后调用 `run-pgy-task.mjs` 打开本机 Chrome 采集蒲公英。服务器上的 `MENGLI_COLLECTOR_WORKER_ENABLED` 仍建议保持 `0`，避免云服务器尝试启动无登录态的浏览器。

联调时请确认：

1. 网站页面能访问 `https://你的媒体库后端域名/api/health`，且返回 `{"ok": true, ...}`。
2. 浏览器里 `MEDIA_API_BASE` 指向同一个媒体库后端。
3. 本机 worker 的 `MENGLI_SERVER` 也指向同一个媒体库后端。
4. worker 只在一台采集电脑上运行，第一版先避免多机并发造成蒲公英登录态或风控问题。
5. worker 终端出现 `已连接媒体库后端` 后，再在网页点击“开始找号”。

首次运行会使用：

```text
creator-workbench/data/browser-profiles/pgy
```

在弹出的 Chrome 登录蒲公英后，后续任务会复用这个 profile。

## 媒体库权限

媒体库联系方式和资料维护依赖主站 Supabase 权限：

- 管理员：`user_profiles.role = admin`
- 媒介：`user_profiles.position` 包含 `媒介`，或未来扩展 `role = media`
- 普通用户：可以查看达人、返点、报价、标签，但看不到联系方式，也不能导入、编辑、修复媒体库资料

前端会读取当前 Supabase session 并按上述规则隐藏联系方式和修改入口。上线时请确认登录注册、用户审批、`user_profiles` 表和主站权限脚本正常。

## SQLite 备份

数据库文件：

```text
creator-workbench/data/mengli_creator_selection.sqlite3
```

建议每天备份一次：

```bash
mkdir -p creator-workbench/backups
sqlite3 creator-workbench/data/mengli_creator_selection.sqlite3 ".backup 'creator-workbench/backups/mengli_creator_selection_$(date +%Y%m%d_%H%M%S).sqlite3'"
```

恢复时先停止服务，再替换数据库文件。

## 回滚方案

1. Web 服务回滚到上一个 GitHub 分支或上一个 Railway deployment。
2. 停止 worker，避免旧页面和新 worker 混跑。
3. 用最近一次 SQLite 备份恢复数据库。
4. 重新启动后访问 `/api/health`，确认服务、数据库和 worker 状态。

## Playwright 登录态

登录态目录应被持久化，不要提交到 GitHub：

```text
creator-workbench/data/browser-profiles/pgy
```

登录失效时，页面会显示 `需要在Chrome登录蒲公英`；在采集节点打开该 profile 登录后，重新点击开始找号即可。
