# 萌力互动本地 AI 选号系统

这是给内部测试用的本地版。首版先跑通“小红书蒲公英 + 双模型 brief 拆解 + 后台采集 worker + 规则推荐引擎”的选号闭环，后续再迁移到固定采集节点或公司服务器。

## 启动

```bash
cd /Users/tulei/Desktop/Codex智能工作区/workspace/萌力互动找号本地版-0611
bash start-local.sh
```

或只启动后端：

```bash
cd /Users/tulei/Desktop/Codex智能工作区/workspace/萌力互动找号本地版-0611/creator-workbench
bash start.sh
```

打开：

```text
http://127.0.0.1:8890
```

本地服务会默认跳到：

```text
http://127.0.0.1:8890/index.html?page=find
```

UI 使用项目根目录的 `index.html`，也就是后续准备同步到 GitHub 的网站主页面；本地服务只负责提供接口、数据文件和素材路由，不再维护另一套找号界面。

## 首版流程

1. 新建项目，粘贴客户 brief。
2. `AI 拆解需求` 调用 `/api/brief-intelligence`，默认走 Codex CLI；DeepSeek 可通过环境变量切换。
3. 页面展示策略卡：客户目标、达人画像、搜索词、同义词、数据门槛、风险和人工确认项。
4. 人工确认后点击“开始找号”，系统创建后台采集任务。
5. 本地 worker 自动轮询任务，调用 `scripts/run-pgy-task.mjs`，用已登录 Chrome 采集蒲公英。
6. 首次运行需要在专用 Chrome profile 里登录蒲公英；后续复用本地登录态。
7. runner 按 brief 策略搜索、翻页、去重、打开详情页补抓官方指标和标题，并回传数据。
8. 后端规则引擎按预算、标题相关、内容相关、官方指标、CPM/CPE、粉丝量级和历史反馈打分。
9. 页面生成严格达标、可备选、不建议三层结果和整批判断。
10. 媒介复核客户选中结果，客户通过或反馈可用后再沉淀进媒体库。

## 当前本地实现

- 数据库：`data/mengli_creator_selection.sqlite3`
- 后端：`server.py`
- 前端：项目根目录 `index.html` / `kols-dashboard.html`
- 导出：通过 `/api/projects/{project_id}/export` 生成 `.xlsx`
- 后台采集 worker：服务启动后自动轮询 `codex_tasks` 里的 queued 任务
- 蒲公英采集 runner：`scripts/run-pgy-task.mjs`
- 蒲公英扩展：`collector-extension/pgy-local-collector`，保留为备用调试路径
- 真实采集回传接口：`POST /api/collector/ingest`

## 模型配置

默认测试阶段使用 Codex CLI 做 brief 拆解；如果 Codex/DeepSeek 不可用，会自动回退本地规则，页面会显示“本地规则兜底”。

```bash
# codex | deepseek | local
export BRIEF_MODEL_PROVIDER=codex

# 可选：指定 Codex 或 DeepSeek 模型名
export BRIEF_MODEL_NAME=""

# 使用 DeepSeek 时配置
export DEEPSEEK_API_KEY="sk-..."
export DEEPSEEK_MODEL_NAME="deepseek-chat"
export DEEPSEEK_API_BASE="https://api.deepseek.com"

# Codex CLI 路径，默认从 PATH 找 codex
export CODEX_EXECUTABLE="codex"
```

## 后台采集 worker

本地默认启用 worker；Railway 等普通 Web 环境默认禁用，避免没有浏览器环境时反复拉起 Playwright。固定采集电脑或云桌面部署时，可以显式启用：

```bash
export MENGLI_COLLECTOR_WORKER_ENABLED=1
export MENGLI_SERVER="http://127.0.0.1:8890"
export MENGLI_COLLECTOR_WORKER_POLL_SECONDS=3
export MENGLI_COLLECTOR_TASK_MAX_AGE_HOURS=24

# 可选：指定 Node 路径
export MENGLI_NODE_BIN="/usr/local/bin/node"
```

worker 会自动运行：

```bash
node creator-workbench/scripts/run-pgy-task.mjs codex_xxx
```

runner 会使用专用浏览器 profile：

```text
creator-workbench/data/browser-profiles/pgy
```

采集器会把采集状态写回本地，并把采到的数据 POST 到：

```text
POST /api/collector/ingest
```

字段可用中文表头或统一字段，例如：

```json
{
  "project_id": "project_xxx",
  "platform": "pgy",
  "rows": [
    {
      "达人名称": "示例达人",
      "平台ID": "xhs_id",
      "主页链接": "https://pgy.xiaohongshu.com/...",
      "粉丝数": 8.5,
      "图文报价": 5000,
      "视频报价": 8000,
      "内容标签": ["美食", "开箱测评"],
      "人群标签": ["上班族"],
      "返点": 22,
      "阅读中位数": 90000,
      "互动中位数": 1400,
      "CPM": 58,
      "CPE": 6.3,
      "最近50条标题": ["标题1", "标题2"]
    }
  ]
}
```

说明：

- 首轮只跑小红书蒲公英，星图、抖音、腾讯互选先保留入口。
- 返点只展示和导出，不参与推荐判断。
- 不采集、不判断“是否支持挂链”；brief 里提到挂链时只作为需求信息保留。
- AI 不直接决定推荐名单；Codex/DeepSeek 只输出 brief 策略，最终名单由后端规则引擎生成。
