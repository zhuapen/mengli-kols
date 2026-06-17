-- 文案版本管理 + 历史软删除迁移脚本
-- 执行方式：在 Supabase SQL Editor 中运行

-- 版本管理字段
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES generation_history(id);
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS root_id INTEGER;
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS original_content TEXT;
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS edit_content TEXT;
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'generate';

-- 软删除
ALTER TABLE generation_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 索引
CREATE INDEX IF NOT EXISTS idx_generation_history_parent ON generation_history(parent_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_root ON generation_history(root_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_deleted ON generation_history(deleted_at) WHERE deleted_at IS NOT NULL;

-- RLS 策略：允许用户更新自己的历史（编辑/软删除）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own history' AND tablename = 'generation_history'
  ) THEN
    CREATE POLICY "Users can update own history" ON generation_history
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS 策略：允许用户删除自己的历史
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own history' AND tablename = 'generation_history'
  ) THEN
    CREATE POLICY "Users can delete own history" ON generation_history
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 授权
GRANT DELETE ON generation_history TO authenticated;
GRANT UPDATE ON generation_history TO authenticated;
