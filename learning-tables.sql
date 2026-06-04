-- 萌力互动 · A+B 学习系统数据库表

-- 1. 用户偏好表
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    pref_key TEXT NOT NULL,
    pref_value TEXT NOT NULL,
    use_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, pref_key, pref_value)
);

-- 2. 生成历史 + 评分表
CREATE TABLE IF NOT EXISTS public.generation_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    gen_type TEXT NOT NULL CHECK (gen_type IN ('copywriting', 'article', 'image_gen')),
    input_params JSONB,
    output_content TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON public.user_preferences(user_id, pref_key);
CREATE INDEX IF NOT EXISTS idx_generation_history_user ON public.generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_type ON public.generation_history(user_id, gen_type);
CREATE INDEX IF NOT EXISTS idx_generation_history_rating ON public.generation_history(user_id, rating);

-- 4. 设置 RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略 - 用户偏好表
CREATE POLICY "Users can view own preferences"
    ON public.user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON public.user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON public.user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- 6. RLS 策略 - 生成历史表
CREATE POLICY "Users can view own history"
    ON public.generation_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
    ON public.generation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history"
    ON public.generation_history FOR UPDATE
    USING (auth.uid() = user_id);

-- 7. 管理员可以查看所有数据
CREATE POLICY "Admins can view all preferences"
    ON public.user_preferences FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all history"
    ON public.generation_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
