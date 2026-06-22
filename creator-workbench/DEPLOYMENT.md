# 智能媒体库部署说明

## Railway / Web 服务

Railway 只建议承载 FastAPI 后端和数据库接口，不建议直接跑蒲公英采集 worker，除非环境里有可用 Chrome、持久化磁盘和稳定登录态。

推荐环境变量：

```bash
BRIEF_MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL_NAME=deepseek-chat
MENGLI_COLLECTOR_WORKER_ENABLED=0
```

如果前端是独立主站，需要把主站里的 `MEDIA_API_BASE` 指向 Railway 服务地址。

## 固定采集电脑 / 云桌面

采集节点需要 Chrome 登录态和 Playwright，因此建议部署在固定 Mac、Windows 云桌面或带 GUI 的内网机器。

```bash
BRIEF_MODEL_PROVIDER=codex
MENGLI_COLLECTOR_WORKER_ENABLED=1
MENGLI_SERVER=http://127.0.0.1:8890
```

首次运行会使用：

```text
creator-workbench/data/browser-profiles/pgy
```

在弹出的 Chrome 登录蒲公英后，后续任务会复用这个 profile。

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
