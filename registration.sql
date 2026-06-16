-- 注册审批功能数据库变更

-- 1. 新增字段
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS approved_by uuid;

-- 2. 已有管理员/用户默认设为 approved（不影响现有账号）
UPDATE public.user_profiles SET status = 'approved' WHERE status IS NULL OR status = '';

-- 3. 修改 RLS：只有 approved 用户能读取系统数据
-- 先删旧策略
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

-- 新策略：approved 用户可读自己的 profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id AND (
        SELECT status FROM public.user_profiles WHERE id = auth.uid()
    ) = 'approved');

-- 管理员可读所有 profile（不受 status 限制）
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- 管理员可更新所有 profile（审批用）
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.user_profiles FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- 4. 素材/历史等表：只有 approved 用户能操作
-- user_assets
DROP POLICY IF EXISTS "Anyone can view assets" ON public.user_assets;
CREATE POLICY "Approved users can view assets" ON public.user_assets FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved'));

DROP POLICY IF EXISTS "Anyone can insert assets" ON public.user_assets;
CREATE POLICY "Approved users can insert assets" ON public.user_assets FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved'));

DROP POLICY IF EXISTS "Anyone can update assets" ON public.user_assets;
CREATE POLICY "Approved users can update assets" ON public.user_assets FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved'));

DROP POLICY IF EXISTS "Anyone can delete assets" ON public.user_assets;
CREATE POLICY "Approved users can delete assets" ON public.user_assets FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved'));

-- generation_history
DROP POLICY IF EXISTS "Users can view own history" ON public.generation_history;
CREATE POLICY "Approved users can view history" ON public.generation_history FOR SELECT
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved'));

DROP POLICY IF EXISTS "Users can insert own history" ON public.generation_history;
CREATE POLICY "Approved users can insert history" ON public.generation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND status = 'approved'));
