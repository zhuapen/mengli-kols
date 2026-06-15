-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid,
    admin_name text DEFAULT '',
    action text NOT NULL,
    target text DEFAULT '',
    details text DEFAULT '',
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.admin_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can insert logs" ON public.admin_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));
