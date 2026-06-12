-- 修复1: feedback-images Storage 允许所有人上传（反馈不需要登录）
DROP POLICY IF EXISTS "Anyone can upload feedback images" ON storage.objects;
CREATE POLICY "Anyone can upload feedback images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback-images');

-- 修复2: plugin_feedback 允许所有人更新状态（管理员面板用）
DROP POLICY IF EXISTS "Admins can update feedback" ON public.plugin_feedback;
CREATE POLICY "Anyone can update feedback" ON public.plugin_feedback FOR UPDATE USING (true);
