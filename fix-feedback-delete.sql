-- 补充 DELETE 策略（之前漏了）
CREATE POLICY "fb_delete" ON public.plugin_feedback FOR DELETE USING (true);
