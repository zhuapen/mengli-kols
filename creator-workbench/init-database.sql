-- 萌力互动 · 全量数据库初始化脚本
-- 替代 Supabase，自建 PostgreSQL

-- 1. 用户表
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    position TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    session_token TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 功能权限定义
CREATE TABLE IF NOT EXISTS feature_permissions (
    id SERIAL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    feature_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 用户功能权限
CREATE TABLE IF NOT EXISTS user_feature_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, feature_key)
);

-- 4. 素材库
CREATE TABLE IF NOT EXISTS user_assets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'copy', 'article')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 品牌库
CREATE TABLE IF NOT EXISTS user_brands (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    tone TEXT DEFAULT '',
    selling_points TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 模板库
CREATE TABLE IF NOT EXISTS user_templates (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    size TEXT DEFAULT '1024x1024',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 用户偏好
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    pref_key TEXT NOT NULL,
    pref_value TEXT NOT NULL,
    use_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, pref_key, pref_value)
);

-- 8. 生成历史
CREATE TABLE IF NOT EXISTS generation_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    gen_type TEXT NOT NULL CHECK (gen_type IN ('copywriting', 'article', 'image_gen')),
    input_params JSONB,
    output_content TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_favorite BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    parent_id INTEGER REFERENCES generation_history(id),
    root_id INTEGER,
    original_content TEXT,
    edit_content TEXT,
    operation_type TEXT DEFAULT 'generate',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 反馈记录
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    history_id INTEGER,
    gen_type TEXT DEFAULT '',
    original_content TEXT DEFAULT '',
    feedback_text TEXT DEFAULT '',
    improved_content TEXT DEFAULT '',
    changes_summary TEXT DEFAULT '',
    learnings TEXT DEFAULT '',
    rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 插件
CREATE TABLE IF NOT EXISTS plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '',
    version TEXT NOT NULL,
    short_desc TEXT DEFAULT '',
    description TEXT DEFAULT '',
    platforms TEXT DEFAULT '',
    install_guide TEXT DEFAULT '',
    known_issues TEXT DEFAULT '',
    download_url TEXT DEFAULT '',
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 插件更新日志
CREATE TABLE IF NOT EXISTS plugin_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 插件反馈
CREATE TABLE IF NOT EXISTS plugin_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
    user_id TEXT DEFAULT '',
    user_name TEXT DEFAULT '',
    feedback_type TEXT DEFAULT 'bug',
    content TEXT NOT NULL,
    images TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 管理员操作日志
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    admin_name TEXT DEFAULT '',
    action TEXT NOT NULL,
    target TEXT DEFAULT '',
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_session ON user_profiles(session_token);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_assets_user ON user_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_type ON user_assets(user_id, type);
CREATE INDEX IF NOT EXISTS idx_generation_history_user ON generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_type ON generation_history(user_id, gen_type);
CREATE INDEX IF NOT EXISTS idx_generation_history_rating ON generation_history(user_id, rating);
CREATE INDEX IF NOT EXISTS idx_generation_history_parent ON generation_history(parent_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_root ON generation_history(root_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

-- 插入默认功能权限
INSERT INTO feature_permissions (feature_key, feature_name, description) VALUES
    ('image_gen', '图片生成', '文生图和图生图功能'),
    ('copywriting', '文案撰写', 'AI文案生成功能'),
    ('article', '公众号写稿', '公众号文章生成'),
    ('assets', '素材库', '查看和管理素材'),
    ('find', '智能媒体库', '达人找号和推荐'),
    ('knowledge', '品牌知识库', '品牌信息查看'),
    ('history', '生成历史', '查看历史记录'),
    ('datacenter', '数据中心', '管理员数据中心')
ON CONFLICT (feature_key) DO NOTHING;

-- 创建默认管理员账号（密码: admin123，pbkdf2 hash）
INSERT INTO user_profiles (email, password_hash, display_name, role, position, is_active, status) VALUES
    ('admin@mengliai.cn', '$pbkdf2$f4e89f8a745d43e0$852d6d45a7ad0c1fb58d4cc8492ae4cc2fd77d2d22daf2e62261adbe11e8e4ca', '管理员', 'admin', '管理员', true, 'approved')
ON CONFLICT (email) DO NOTHING;

-- 管理员拥有所有权限
INSERT INTO user_feature_permissions (user_id, feature_key)
SELECT id, feature_key FROM user_profiles, feature_permissions WHERE email = 'admin@mengliai.cn'
ON CONFLICT DO NOTHING;
