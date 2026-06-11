-- 插件中心数据库表
-- 在 Supabase Dashboard > SQL Editor 中执行

-- 1. 插件主信息表
CREATE TABLE IF NOT EXISTS public.plugins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    icon text DEFAULT '🔌',
    version text NOT NULL,
    short_desc text DEFAULT '',
    description text DEFAULT '',
    platforms text DEFAULT '',
    install_guide text DEFAULT '',
    known_issues text DEFAULT '',
    download_url text DEFAULT '',
    downloads integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. 更新日志表
CREATE TABLE IF NOT EXISTS public.plugin_changelog (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plugin_id uuid REFERENCES public.plugins(id) ON DELETE CASCADE,
    version text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 3. 用户反馈表
CREATE TABLE IF NOT EXISTS public.plugin_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plugin_id uuid REFERENCES public.plugins(id) ON DELETE CASCADE,
    user_id text,
    feedback_type text DEFAULT 'bug',
    content text NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

-- 4. RLS 策略
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugin_changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugin_feedback ENABLE ROW LEVEL SECURITY;

-- plugins: 所有人可读
CREATE POLICY "Anyone can view plugins"
    ON public.plugins FOR SELECT USING (true);

-- plugins: 管理员可增删改
CREATE POLICY "Admins can manage plugins"
    ON public.plugins FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- changelog: 所有人可读
CREATE POLICY "Anyone can view changelog"
    ON public.plugin_changelog FOR SELECT USING (true);

-- changelog: 管理员可增删改
CREATE POLICY "Admins can manage changelog"
    ON public.plugin_changelog FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- feedback: 所有人可插入
CREATE POLICY "Anyone can submit feedback"
    ON public.plugin_feedback FOR INSERT WITH CHECK (true);

-- feedback: 管理员可查看和更新
CREATE POLICY "Admins can view feedback"
    ON public.plugin_feedback FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update feedback"
    ON public.plugin_feedback FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. 插入示例数据
INSERT INTO public.plugins (name, icon, version, short_desc, description, platforms, install_guide, known_issues, download_url, downloads) VALUES
('Chrome达人采集助手', '🧭', 'v1.2.5', '批量采集达人主页信息，导出Excel，数据筛选', 'Chrome浏览器插件，支持批量采集小红书、抖音达人主页信息，一键导出Excel表格，支持数据筛选和批量管理。', 'Chrome, Edge', '1. 下载插件压缩包并解压
2. 打开 Chrome 浏览器，进入 chrome://extensions/
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的文件夹
6. 插件图标出现在浏览器工具栏即安装成功', '当前暂不支持 Safari 浏览器和 Edge 老版本', '#', 2531);
