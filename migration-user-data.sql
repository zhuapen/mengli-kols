-- 萌力互动 · 用户数据迁移（素材库 + 品牌 + 模板从 localStorage → Supabase）

-- 1. 素材库表
CREATE TABLE IF NOT EXISTS public.user_assets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'copy', 'article')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 自定义品牌表
CREATE TABLE IF NOT EXISTS public.user_brands (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    tone TEXT,
    selling_points TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 提示词模板表
CREATE TABLE IF NOT EXISTS public.user_templates (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    size TEXT DEFAULT '1024x1024',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_assets_user ON public.user_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_type ON public.user_assets(user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_brands_user ON public.user_brands(user_id);
CREATE INDEX IF NOT EXISTS idx_user_templates_user ON public.user_templates(user_id);

-- 5. 设置 RLS
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_templates ENABLE ROW LEVEL SECURITY;

-- 6. RLS 策略 - 素材库
CREATE POLICY "Users can view own assets"
    ON public.user_assets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
    ON public.user_assets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
    ON public.user_assets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
    ON public.user_assets FOR DELETE
    USING (auth.uid() = user_id);

-- 7. RLS 策略 - 品牌
CREATE POLICY "Users can view own brands"
    ON public.user_brands FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brands"
    ON public.user_brands FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own brands"
    ON public.user_brands FOR DELETE
    USING (auth.uid() = user_id);

-- 8. RLS 策略 - 模板
CREATE POLICY "Users can view own templates"
    ON public.user_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
    ON public.user_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
    ON public.user_templates FOR DELETE
    USING (auth.uid() = user_id);

-- 9. 管理员可以查看所有数据
CREATE POLICY "Admins can view all assets"
    ON public.user_assets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all brands"
    ON public.user_brands FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all templates"
    ON public.user_templates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 10. 授权
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_assets TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_brands TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_templates TO authenticated;
GRANT ALL ON public.user_assets TO service_role;
GRANT ALL ON public.user_brands TO service_role;
GRANT ALL ON public.user_templates TO service_role;
