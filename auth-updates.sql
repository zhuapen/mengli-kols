-- 功能二：单设备登录 — user_profiles 新增 session_token
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS session_token text DEFAULT '';

-- 功能三：素材库共享 — 修改 RLS 策略
DROP POLICY IF EXISTS "Users can view own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users can update own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON public.user_assets;

CREATE POLICY "Anyone can view assets" ON public.user_assets FOR SELECT USING (true);
CREATE POLICY "Anyone can insert assets" ON public.user_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update assets" ON public.user_assets FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete assets" ON public.user_assets FOR DELETE USING (true);
