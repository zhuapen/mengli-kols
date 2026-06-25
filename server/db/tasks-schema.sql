-- 任务调度系统表结构

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,                    -- 任务类型：pgy_collect, brief_intelligence, etc.
  status TEXT DEFAULT 'pending',         -- pending, running, done, failed
  priority INTEGER DEFAULT 0,            -- 优先级，数字越大越优先
  payload JSONB,                         -- 任务参数
  result JSONB,                          -- 执行结果
  error TEXT,                            -- 错误信息
  worker_id TEXT,                        -- 执行任务的 worker 标识
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- Brief 分析表
CREATE TABLE IF NOT EXISTS briefs (
  id SERIAL PRIMARY KEY,
  project_id TEXT,                       -- 项目 ID
  user_id UUID REFERENCES user_profiles(id),
  original_text TEXT,                    -- 原始 brief 文本
  analysis JSONB,                        -- AI 分析结果
  status TEXT DEFAULT 'draft',           -- draft, confirmed, executing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- KOL 数据表
CREATE TABLE IF NOT EXISTS kols (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,                -- xhs, douyin, etc.
  name TEXT NOT NULL,
  avatar TEXT,
  followers INTEGER,
  engagement_rate DECIMAL,
  price_range TEXT,
  tags JSONB,
  metrics JSONB,                         -- 详细指标
  source TEXT,                           -- 数据来源：pgy, manual, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 采集结果表
CREATE TABLE IF NOT EXISTS collection_results (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  brief_id INTEGER REFERENCES briefs(id),
  kol_id INTEGER REFERENCES kols(id),
  score DECIMAL,                         -- 推荐分数
  reason TEXT,                           -- 推荐理由
  status TEXT DEFAULT 'pending',         -- pending, approved, rejected
  feedback TEXT,                         -- 用户反馈
  created_at TIMESTAMP DEFAULT NOW()
);

-- Worker 状态表
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,                   -- worker 标识
  name TEXT,
  status TEXT DEFAULT 'offline',         -- offline, online, busy
  last_heartbeat TIMESTAMP,
  capabilities JSONB,                    -- worker 能力：["pgy_collect", "ai_analysis"]
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_kols_platform ON kols(platform);
CREATE INDEX IF NOT EXISTS idx_collection_results_brief_id ON collection_results(brief_id);
