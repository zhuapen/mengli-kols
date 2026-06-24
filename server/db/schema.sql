-- 萌力互动 · 数据库建表脚本

-- 用户表
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  position TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'pending',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by INTEGER
);

-- 功能权限定义表
CREATE TABLE IF NOT EXISTS feature_permissions (
  id SERIAL PRIMARY KEY,
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT DEFAULT ''
);

-- 用户功能权限关联表
CREATE TABLE IF NOT EXISTS user_feature_permissions (
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  PRIMARY KEY (user_id, feature_key)
);

-- 生成历史表
CREATE TABLE IF NOT EXISTS generation_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id),
  gen_type TEXT NOT NULL,
  input_params JSONB,
  output_content TEXT,
  rating INTEGER,
  version INTEGER DEFAULT 1,
  parent_id INTEGER,
  root_id INTEGER,
  original_content TEXT,
  operation_type TEXT DEFAULT 'generate',
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- 素材表
CREATE TABLE IF NOT EXISTS user_assets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id),
  type TEXT,
  title TEXT,
  content TEXT,
  rating INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 品牌表
CREATE TABLE IF NOT EXISTS user_brands (
  id UUID PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  selling_points TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 模板表
CREATE TABLE IF NOT EXISTS user_templates (
  id UUID PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  size TEXT DEFAULT '1024x1024',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 用户偏好表
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER REFERENCES user_profiles(id),
  pref_key TEXT NOT NULL,
  pref_value TEXT,
  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, pref_key)
);

-- 反馈表
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id),
  history_id INTEGER,
  gen_type TEXT,
  original_content TEXT,
  feedback_text TEXT,
  improved_content TEXT,
  changes_summary TEXT,
  learnings TEXT,
  rating INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 插件表
CREATE TABLE IF NOT EXISTS plugins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🔌',
  version TEXT DEFAULT '1.0',
  short_desc TEXT DEFAULT '',
  description TEXT DEFAULT '',
  platforms TEXT DEFAULT '',
  install_guide TEXT DEFAULT '',
  known_issues TEXT DEFAULT '',
  download_url TEXT DEFAULT '#',
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 插件更新日志表
CREATE TABLE IF NOT EXISTS plugin_changelog (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
  version TEXT,
  changes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 插件反馈表
CREATE TABLE IF NOT EXISTS plugin_feedback (
  id SERIAL PRIMARY KEY,
  plugin_id INTEGER REFERENCES plugins(id),
  user_id TEXT,
  user_name TEXT,
  feedback_type TEXT DEFAULT 'bug',
  content TEXT,
  images TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  admin_name TEXT,
  action TEXT,
  target TEXT DEFAULT '',
  details TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 默认功能权限
INSERT INTO feature_permissions (feature_key, feature_name) VALUES
  ('find', '找号'),
  ('image_gen', '图片生成'),
  ('copywriting', '文案撰写'),
  ('article', '推文生成'),
  ('assets', '素材库'),
  ('knowledge', '知识库'),
  ('plugin', '数据中心'),
  ('history', '历史记录')
ON CONFLICT (feature_key) DO NOTHING;
