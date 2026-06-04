-- 萌力互动 · 权限系统数据库设置（方案B：按功能模块勾选）

-- 1. 用户配置表（扩展 Supabase Auth）
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    position TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 功能权限配置表
CREATE TABLE IF NOT EXISTS public.feature_permissions (
    id SERIAL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    feature_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 用户功能权限表（记录每个用户能用哪些功能）
CREATE TABLE IF NOT EXISTS public.user_feature_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, feature_key)
);

-- 4. 插入默认功能配置
INSERT INTO public.feature_permissions (feature_key, feature_name, description) VALUES
    ('find', '找号', '达人查找和筛选'),
    ('image_gen', '图片生成', 'AI生成营销图片'),
    ('copywriting', '文案撰写', 'AI生成种草文案'),
    ('article', '写稿生成', 'AI生成公众号写稿'),
    ('assets', '素材库', '管理生成的素材'),
    ('knowledge', '知识库', '写作模板和案例')
ON CONFLICT (feature_key) DO NOTHING;

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_feature_permissions_user ON public.user_feature_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_permissions_feature ON public.user_feature_permissions(feature_key);

-- 6. 设置 RLS (Row Level Security)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_permissions ENABLE ROW LEVEL SECURITY;

-- 7. 用户配置表的 RLS 策略
-- 用户可以查看自己的配置
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- 管理员可以查看所有配置
CREATE POLICY "Admins can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理员可以更新所有配置
CREATE POLICY "Admins can update all profiles"
    ON public.user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理员可以插入新配置
CREATE POLICY "Admins can insert profiles"
    ON public.user_profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 8. 功能权限表的 RLS 策略
-- 所有人可以查看功能列表
CREATE POLICY "Anyone can view features"
    ON public.feature_permissions FOR SELECT
    USING (true);

-- 只有管理员可以修改功能配置
CREATE POLICY "Admins can manage features"
    ON public.feature_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 9. 用户功能权限表的 RLS 策略
-- 用户可以查看自己的权限
CREATE POLICY "Users can view own permissions"
    ON public.user_feature_permissions FOR SELECT
    USING (auth.uid() = user_id);

-- 管理员可以查看所有权限
CREATE POLICY "Admins can view all permissions"
    ON public.user_feature_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理员可以管理所有权限
CREATE POLICY "Admins can manage all permissions"
    ON public.user_feature_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 10. 创建函数：自动创建用户配置
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name, role, position)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'user',
        COALESCE(NEW.raw_user_meta_data->>'position', '未设置')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 创建触发器：新用户注册时自动创建配置
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. 创建函数：更新时间戳
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. 创建触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 14. 授予权限
GRANT SELECT ON public.feature_permissions TO anon;
GRANT SELECT ON public.feature_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_feature_permissions TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
GRANT ALL ON public.user_feature_permissions TO service_role;
