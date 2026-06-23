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

如果前端是独立主站，需要把主站里的 `MEDIA_API_BASE` 指向 Railway 服务地址。

## 本机采集 worker

采集节点需要 Chrome 登录态和 Playwright。当前方案是 worker 放在你的电脑上，不上服务器；网页上的“开始找号”会在服务器创建 queued 任务，你电脑上的 worker 自动领取任务、打开已登录 Chrome 采集蒲公英并回传。

```bash
BRIEF_MODEL_PROVIDER=codex
CODEX_EXECUTABLE=codex
MENGLI_COLLECTOR_WORKER_ENABLED=1
MENGLI_SERVER=https://你的服务器域名
```

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
